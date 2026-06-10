use std::{
    convert::Infallible,
    net::{Ipv4Addr, SocketAddr},
    sync::Arc,
};

use bytes::Bytes;
use futures_util::{SinkExt, StreamExt, TryStreamExt};
use http_body_util::{combinators::BoxBody, BodyExt, Empty, Full, StreamBody};
use hyper::{
    body::{Frame, Incoming},
    header::{
        HeaderName, HeaderValue, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS,
        ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_EXPOSE_HEADERS, CONNECTION, CONTENT_LENGTH,
        HOST, ORIGIN, TRANSFER_ENCODING, UPGRADE,
    },
    server::conn::http1,
    service::service_fn,
    Method, Request, Response, StatusCode, Uri,
};
use hyper_util::rt::TokioIo;
use tokio::{net::TcpListener, sync::Mutex, sync::RwLock};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{handshake::derive_accept_key, protocol::Role},
    WebSocketStream,
};
use url::Url;

type ProxyError = Box<dyn std::error::Error + Send + Sync>;
type ProxyBody = BoxBody<Bytes, ProxyError>;

const LOCAL_GATEWAY_HOST: Ipv4Addr = Ipv4Addr::LOCALHOST;
const SEC_WEBSOCKET_KEY: &str = "sec-websocket-key";
const SEC_WEBSOCKET_ACCEPT: &str = "sec-websocket-accept";

#[derive(Clone)]
pub struct DesktopGatewayState {
    inner: Arc<GatewayInner>,
}

struct GatewayInner {
    server: Mutex<Option<GatewayServer>>,
    target: RwLock<Option<GatewayTarget>>,
    http_client: reqwest::Client,
}

struct GatewayServer {
    origin: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct GatewayTarget {
    http_origin: String,
    ws_origin: String,
}

impl Default for DesktopGatewayState {
    fn default() -> Self {
        Self {
            inner: Arc::new(GatewayInner {
                server: Mutex::new(None),
                target: RwLock::new(None),
                http_client: reqwest::Client::new(),
            }),
        }
    }
}

impl DesktopGatewayState {
    pub async fn gateway_http_origin(&self) -> Result<String, String> {
        self.ensure_started().await
    }

    pub async fn set_remote_target(
        &self,
        target_http_origin: Option<&str>,
    ) -> Result<Option<String>, String> {
        let target = target_http_origin.map(build_gateway_target).transpose()?;
        let gateway_origin = if target.is_some() {
            Some(self.ensure_started().await?)
        } else {
            None
        };

        let mut current_target = self.inner.target.write().await;
        *current_target = target;
        Ok(gateway_origin)
    }

    async fn ensure_started(&self) -> Result<String, String> {
        let mut server = self.inner.server.lock().await;
        if let Some(server) = server.as_ref() {
            return Ok(server.origin.clone());
        }

        let listener = TcpListener::bind(SocketAddr::from((LOCAL_GATEWAY_HOST, 0)))
            .await
            .map_err(|error| format!("failed to bind desktop gateway: {error}"))?;
        let local_addr = listener
            .local_addr()
            .map_err(|error| format!("failed to resolve desktop gateway address: {error}"))?;
        let origin = format!("http://{}:{}", LOCAL_GATEWAY_HOST, local_addr.port());
        let inner = Arc::clone(&self.inner);

        tauri::async_runtime::spawn(async move {
            run_gateway(listener, inner).await;
        });

        *server = Some(GatewayServer {
            origin: origin.clone(),
        });
        Ok(origin)
    }
}

fn build_gateway_target(target_http_origin: &str) -> Result<GatewayTarget, String> {
    let http_origin = normalize_remote_http_origin(target_http_origin)?;
    let ws_origin = derive_remote_ws_origin(&http_origin)?;

    Ok(GatewayTarget {
        http_origin,
        ws_origin,
    })
}

pub fn normalize_remote_http_origin(value: &str) -> Result<String, String> {
    let url = Url::parse(value.trim()).map_err(|_| "remote backend URL must be absolute")?;
    if url.scheme() != "https" {
        return Err("remote backend URL must use https://".to_string());
    }
    if url.username() != "" || url.password().is_some() {
        return Err("remote backend URL must not include credentials".to_string());
    }
    if url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
        return Err("remote backend URL must include only an origin".to_string());
    }

    Ok(url.origin().ascii_serialization())
}

fn derive_remote_ws_origin(http_origin: &str) -> Result<String, String> {
    let mut url = Url::parse(http_origin).map_err(|_| "remote backend URL must be absolute")?;
    url.set_scheme("wss")
        .map_err(|_| "remote WebSocket URL must use wss://")?;
    Ok(url.origin().ascii_serialization())
}

async fn run_gateway(listener: TcpListener, inner: Arc<GatewayInner>) {
    loop {
        let Ok((stream, _peer)) = listener.accept().await else {
            continue;
        };
        let inner = Arc::clone(&inner);

        tauri::async_runtime::spawn(async move {
            let io = TokioIo::new(stream);
            let service = service_fn(move |request| {
                let inner = Arc::clone(&inner);
                async move { handle_gateway_request(request, inner).await }
            });

            let _ = http1::Builder::new()
                .serve_connection(io, service)
                .with_upgrades()
                .await;
        });
    }
}

async fn handle_gateway_request(
    request: Request<Incoming>,
    inner: Arc<GatewayInner>,
) -> Result<Response<ProxyBody>, Infallible> {
    let response = match route_gateway_request(request, inner).await {
        Ok(response) => response,
        Err(error) => text_response(StatusCode::BAD_GATEWAY, &format!("Gateway error: {error}")),
    };
    Ok(response)
}

async fn route_gateway_request(
    mut request: Request<Incoming>,
    inner: Arc<GatewayInner>,
) -> Result<Response<ProxyBody>, String> {
    if request.method() == Method::OPTIONS {
        return Ok(with_cors_headers(
            Response::builder()
                .status(StatusCode::NO_CONTENT)
                .body(empty_body())
                .map_err(|error| error.to_string())?,
        ));
    }

    let target = inner.target.read().await.clone();
    let Some(target) = target else {
        return Ok(text_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Desktop gateway target is not configured",
        ));
    };

    if is_websocket_upgrade(&request) {
        return handle_websocket_request(&mut request, target).await;
    }

    proxy_http_request(request, target, inner.http_client.clone()).await
}

async fn proxy_http_request(
    request: Request<Incoming>,
    target: GatewayTarget,
    client: reqwest::Client,
) -> Result<Response<ProxyBody>, String> {
    let method = request.method().clone();
    let target_url = build_target_url(&target.http_origin, request.uri())?;
    let headers = request.headers().clone();
    let body_stream = request
        .into_body()
        .into_data_stream()
        .map_err(std::io::Error::other);
    let reqwest_method = reqwest::Method::from_bytes(method.as_str().as_bytes())
        .map_err(|error| error.to_string())?;

    let mut outbound = client
        .request(reqwest_method, target_url)
        .body(reqwest::Body::wrap_stream(body_stream));

    for (name, value) in headers.iter() {
        if should_forward_request_header(name) {
            outbound = outbound.header(name, value);
        }
    }

    let upstream = outbound.send().await.map_err(|error| error.to_string())?;
    let status = upstream.status();
    let mut response = Response::builder().status(status);

    for (name, value) in upstream.headers().iter() {
        if should_forward_response_header(name) {
            response = response.header(name, value);
        }
    }

    let response_stream = upstream
        .bytes_stream()
        .map_ok(Frame::data)
        .map_err(|error| -> ProxyError { Box::new(error) });
    response
        .body(BodyExt::boxed(StreamBody::new(response_stream)))
        .map(with_cors_headers)
        .map_err(|error| error.to_string())
}

async fn handle_websocket_request(
    request: &mut Request<Incoming>,
    target: GatewayTarget,
) -> Result<Response<ProxyBody>, String> {
    let websocket_key = request
        .headers()
        .get(SEC_WEBSOCKET_KEY)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "WebSocket key is missing".to_string())?
        .to_string();
    let target_url = build_target_url(&target.ws_origin, request.uri())?;
    let upgraded = hyper::upgrade::on(request);

    tauri::async_runtime::spawn(async move {
        if let Ok(upgraded) = upgraded.await {
            proxy_websocket(upgraded, target_url).await;
        }
    });

    Response::builder()
        .status(StatusCode::SWITCHING_PROTOCOLS)
        .header(CONNECTION, "Upgrade")
        .header(UPGRADE, "websocket")
        .header(
            SEC_WEBSOCKET_ACCEPT,
            derive_accept_key(websocket_key.as_bytes()),
        )
        .body(empty_body())
        .map_err(|error| error.to_string())
}

async fn proxy_websocket(upgraded: hyper::upgrade::Upgraded, target_url: String) {
    let client_io = TokioIo::new(upgraded);
    let client_ws = WebSocketStream::from_raw_socket(client_io, Role::Server, None).await;
    // The current desktop remote mode trusts the configured Nola Node. A future
    // remote auth flow should add a short-lived live-session token here.
    let Ok((upstream_ws, _response)) = connect_async(target_url).await else {
        return;
    };

    let (mut client_sink, mut client_stream) = client_ws.split();
    let (mut upstream_sink, mut upstream_stream) = upstream_ws.split();

    loop {
        tokio::select! {
            client_message = client_stream.next() => {
                let Some(Ok(message)) = client_message else {
                    break;
                };
                if upstream_sink.send(message).await.is_err() {
                    break;
                }
            }
            upstream_message = upstream_stream.next() => {
                let Some(Ok(message)) = upstream_message else {
                    break;
                };
                if client_sink.send(message).await.is_err() {
                    break;
                }
            }
        }
    }
}

fn build_target_url(origin: &str, uri: &Uri) -> Result<String, String> {
    let path_and_query = uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or("/");
    if !path_and_query.starts_with('/') {
        return Err("gateway request path must be absolute".to_string());
    }

    Ok(format!(
        "{}{}",
        origin.trim_end_matches('/'),
        path_and_query
    ))
}

fn is_websocket_upgrade(request: &Request<Incoming>) -> bool {
    request.method() == Method::GET
        && request
            .headers()
            .get(UPGRADE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.eq_ignore_ascii_case("websocket"))
        && request.headers().contains_key(SEC_WEBSOCKET_KEY)
}

fn should_forward_request_header(name: &HeaderName) -> bool {
    !is_hop_by_hop_header(name) && name != HOST && name != CONTENT_LENGTH && name != ORIGIN
}

fn should_forward_response_header(name: &HeaderName) -> bool {
    !is_hop_by_hop_header(name) && name != TRANSFER_ENCODING && name != CONTENT_LENGTH
}

fn is_hop_by_hop_header(name: &HeaderName) -> bool {
    matches!(
        name.as_str().to_ascii_lowercase().as_str(),
        "connection"
            | "keep-alive"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailer"
            | "transfer-encoding"
            | "upgrade"
    )
}

fn text_response(status: StatusCode, message: &str) -> Response<ProxyBody> {
    with_cors_headers(
        Response::builder()
            .status(status)
            .body(full_body(message.to_string()))
            .unwrap_or_else(|_| Response::new(empty_body())),
    )
}

fn with_cors_headers(mut response: Response<ProxyBody>) -> Response<ProxyBody> {
    let headers = response.headers_mut();
    headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(
        ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, PATCH, DELETE, OPTIONS"),
    );
    headers.insert(ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("*"));
    headers.insert(
        ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static("Content-Disposition"),
    );
    response
}

fn empty_body() -> ProxyBody {
    Empty::<Bytes>::new()
        .map_err(|never| match never {})
        .boxed()
}

fn full_body(message: String) -> ProxyBody {
    Full::new(Bytes::from(message))
        .map_err(|never| match never {})
        .boxed()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_remote_http_origin_accepts_https_origin() {
        assert_eq!(
            normalize_remote_http_origin(" https://nola.example.com ").unwrap(),
            "https://nola.example.com"
        );
    }

    #[test]
    fn normalize_remote_http_origin_rejects_non_origin_values() {
        assert!(normalize_remote_http_origin("http://nola.example.com").is_err());
        assert!(normalize_remote_http_origin("https://nola.example.com/api").is_err());
        assert!(normalize_remote_http_origin("https://user@nola.example.com").is_err());
    }

    #[test]
    fn build_gateway_target_derives_wss_origin() {
        assert_eq!(
            build_gateway_target("https://nola.example.com").unwrap(),
            GatewayTarget {
                http_origin: "https://nola.example.com".to_string(),
                ws_origin: "wss://nola.example.com".to_string(),
            }
        );
    }

    #[test]
    fn build_target_url_preserves_path_and_query() {
        let uri: Uri = "/api/config?fresh=1".parse().unwrap();

        assert_eq!(
            build_target_url("https://nola.example.com", &uri).unwrap(),
            "https://nola.example.com/api/config?fresh=1"
        );
    }
}
