use std::{fs, io, path::PathBuf};
use tauri::Manager;

use super::gateway::{normalize_remote_http_origin, DesktopGatewayState};

const DESKTOP_CONNECTION_CONFIG_FILE: &str = "connection-config.json";
const CONNECTION_CONFIG_VERSION: u8 = 1;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopConnectionRuntimeOptions {
    backend_url: Option<String>,
    gateway_http_origin: Option<String>,
    managed_local_http_origin: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredConnectionConfigPayload {
    version: u8,
    mode: String,
    http_origin: String,
}

#[tauri::command]
pub async fn desktop_connection_runtime_options(
    app_handle: tauri::AppHandle,
    gateway_state: tauri::State<'_, DesktopGatewayState>,
) -> Result<DesktopConnectionRuntimeOptions, String> {
    let backend_url = parse_backend_url_arg(std::env::args().skip(1));
    let saved_remote_target = if backend_url.is_none() {
        load_saved_remote_target(&app_handle)?
    } else {
        None
    };
    let gateway_target =
        resolve_gateway_target(backend_url.as_deref(), saved_remote_target.as_deref());
    let gateway_http_origin = gateway_state
        .set_remote_target(gateway_target.as_deref())
        .await?;

    Ok(build_desktop_connection_runtime_options(
        backend_url,
        gateway_http_origin,
    ))
}

#[tauri::command]
pub fn load_desktop_connection_config(
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, String> {
    let path = desktop_connection_config_path(&app_handle)?;
    match fs::read_to_string(path) {
        Ok(payload) => Ok(Some(payload)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("failed to read desktop connection config: {error}")),
    }
}

#[tauri::command]
pub async fn save_desktop_connection_config(
    app_handle: tauri::AppHandle,
    gateway_state: tauri::State<'_, DesktopGatewayState>,
    payload: String,
) -> Result<(), String> {
    let gateway_target = remote_target_from_config_payload(&payload)?;
    let path = desktop_connection_config_path(&app_handle)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("failed to create desktop connection config directory: {error}")
        })?;
    }

    fs::write(path, payload)
        .map_err(|error| format!("failed to write desktop connection config: {error}"))?;

    gateway_state
        .set_remote_target(gateway_target.as_deref())
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn clear_desktop_connection_config(
    app_handle: tauri::AppHandle,
    gateway_state: tauri::State<'_, DesktopGatewayState>,
) -> Result<(), String> {
    let path = desktop_connection_config_path(&app_handle)?;
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => Err(format!(
            "failed to clear desktop connection config: {error}"
        ))?,
    };

    gateway_state.set_remote_target(None).await?;
    Ok(())
}

fn desktop_connection_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_config_dir()
        .map(|directory| directory.join(DESKTOP_CONNECTION_CONFIG_FILE))
        .map_err(|error| format!("failed to resolve desktop config directory: {error}"))
}

fn build_desktop_connection_runtime_options(
    backend_url: Option<String>,
    gateway_http_origin: Option<String>,
) -> DesktopConnectionRuntimeOptions {
    DesktopConnectionRuntimeOptions {
        backend_url,
        gateway_http_origin,
        managed_local_http_origin: None,
    }
}

#[cfg(test)]
fn build_desktop_connection_runtime_options_from_args<I, S>(
    args: I,
) -> DesktopConnectionRuntimeOptions
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    build_desktop_connection_runtime_options(parse_backend_url_arg(args), None)
}

fn parse_backend_url_arg<I, S>(args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut args = args.into_iter();
    while let Some(arg) = args.next() {
        let arg = arg.as_ref();
        if let Some(value) = arg.strip_prefix("--backend-url=") {
            return non_empty_arg(value);
        }

        if arg == "--backend-url" {
            return args.next().and_then(|value| non_empty_arg(value.as_ref()));
        }
    }

    None
}

fn non_empty_arg(value: &str) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn load_saved_remote_target(app_handle: &tauri::AppHandle) -> Result<Option<String>, String> {
    let path = desktop_connection_config_path(app_handle)?;
    match fs::read_to_string(path) {
        Ok(payload) => Ok(remote_target_from_config_payload(&payload).ok().flatten()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("failed to read desktop connection config: {error}")),
    }
}

fn resolve_gateway_target(
    backend_url: Option<&str>,
    saved_remote_target: Option<&str>,
) -> Option<String> {
    if let Some(backend_url) = backend_url {
        return normalize_remote_http_origin(backend_url).ok();
    }

    saved_remote_target.map(ToOwned::to_owned)
}

fn remote_target_from_config_payload(payload: &str) -> Result<Option<String>, String> {
    let config: StoredConnectionConfigPayload = serde_json::from_str(payload)
        .map_err(|error| format!("desktop connection config payload is invalid: {error}"))?;

    if config.version != CONNECTION_CONFIG_VERSION {
        return Err("desktop connection config version is unsupported".to_string());
    }

    match config.mode.as_str() {
        "remote" => normalize_remote_http_origin(&config.http_origin).map(Some),
        "external-local" => Ok(None),
        _ => Err("desktop connection config mode is unsupported".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_connection_runtime_options_parse_equals_backend_url_arg() {
        let options = build_desktop_connection_runtime_options_from_args([
            "--ignored",
            "--backend-url=https://nola.example.com",
        ]);

        assert_eq!(
            options.backend_url.as_deref(),
            Some("https://nola.example.com")
        );
        assert_eq!(options.gateway_http_origin, None);
        assert_eq!(options.managed_local_http_origin, None);
    }

    #[test]
    fn desktop_connection_runtime_options_parse_separate_backend_url_arg() {
        let options = build_desktop_connection_runtime_options_from_args([
            "--backend-url",
            "http://127.0.0.1:8123",
        ]);

        assert_eq!(
            options.backend_url.as_deref(),
            Some("http://127.0.0.1:8123")
        );
    }

    #[test]
    fn desktop_connection_runtime_options_ignore_empty_backend_url_arg() {
        let options = build_desktop_connection_runtime_options_from_args(["--backend-url", "  "]);

        assert_eq!(options.backend_url, None);
    }

    #[test]
    fn resolve_gateway_target_prefers_remote_backend_url() {
        assert_eq!(
            resolve_gateway_target(
                Some("https://override.example.com/"),
                Some("https://saved.example.com")
            ),
            Some("https://override.example.com".to_string())
        );
    }

    #[test]
    fn resolve_gateway_target_ignores_local_backend_url() {
        assert_eq!(
            resolve_gateway_target(
                Some("http://127.0.0.1:8123"),
                Some("https://saved.example.com")
            ),
            None
        );
    }

    #[test]
    fn resolve_gateway_target_uses_saved_remote_target_without_backend_url() {
        assert_eq!(
            resolve_gateway_target(None, Some("https://saved.example.com")),
            Some("https://saved.example.com".to_string())
        );
    }

    #[test]
    fn remote_target_from_config_payload_extracts_remote_origin() {
        assert_eq!(
            remote_target_from_config_payload(
                r#"{"version":1,"mode":"remote","httpOrigin":"https://nola.example.com/"}"#
            )
            .unwrap(),
            Some("https://nola.example.com".to_string())
        );
    }

    #[test]
    fn remote_target_from_config_payload_clears_local_targets() {
        assert_eq!(
            remote_target_from_config_payload(
                r#"{"version":1,"mode":"external-local","httpOrigin":"http://127.0.0.1:8000"}"#
            )
            .unwrap(),
            None
        );
    }

    #[test]
    fn remote_target_from_config_payload_rejects_invalid_remote_origin() {
        assert!(remote_target_from_config_payload(
            r#"{"version":1,"mode":"remote","httpOrigin":"http://nola.example.com"}"#
        )
        .is_err());
    }
}
