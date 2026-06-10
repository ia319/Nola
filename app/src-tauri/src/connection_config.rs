use std::{fs, io, path::PathBuf};
use tauri::Manager;

const DESKTOP_CONNECTION_CONFIG_FILE: &str = "connection-config.json";

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopConnectionRuntimeOptions {
    backend_url: Option<String>,
    gateway_http_origin: Option<String>,
    managed_local_http_origin: Option<String>,
}

#[tauri::command]
pub fn desktop_connection_runtime_options() -> DesktopConnectionRuntimeOptions {
    build_desktop_connection_runtime_options_from_args(std::env::args().skip(1))
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
pub fn save_desktop_connection_config(
    app_handle: tauri::AppHandle,
    payload: String,
) -> Result<(), String> {
    let path = desktop_connection_config_path(&app_handle)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("failed to create desktop connection config directory: {error}")
        })?;
    }

    fs::write(path, payload)
        .map_err(|error| format!("failed to write desktop connection config: {error}"))
}

#[tauri::command]
pub fn clear_desktop_connection_config(app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = desktop_connection_config_path(&app_handle)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "failed to clear desktop connection config: {error}"
        )),
    }
}

fn desktop_connection_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_config_dir()
        .map(|directory| directory.join(DESKTOP_CONNECTION_CONFIG_FILE))
        .map_err(|error| format!("failed to resolve desktop config directory: {error}"))
}

fn build_desktop_connection_runtime_options_from_args<I, S>(
    args: I,
) -> DesktopConnectionRuntimeOptions
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    DesktopConnectionRuntimeOptions {
        backend_url: parse_backend_url_arg(args),
        gateway_http_origin: None,
        managed_local_http_origin: None,
    }
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
}
