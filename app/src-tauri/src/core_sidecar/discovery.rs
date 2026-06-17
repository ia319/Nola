use std::{
    fs,
    net::{Ipv4Addr, SocketAddrV4, TcpListener},
    path::PathBuf,
};

use tauri::Manager;

use super::process::ManagedCoreSidecarLaunchPlan;

const CORE_SIDECAR_ARG: &str = "--core-sidecar";
const CORE_SIDECAR_ENV: &str = "NOLA_DESKTOP_CORE_SIDECAR_PATH";

pub(crate) fn build_launch_plan(
    app_handle: &tauri::AppHandle,
) -> Result<Option<ManagedCoreSidecarLaunchPlan>, String> {
    let Some(sidecar_path) = resolve_core_sidecar_path(app_handle)? else {
        return Ok(None);
    };
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve desktop data directory: {error}"))?
        .join("core");
    let model_dir = data_dir.join("models");
    let log_dir = data_dir.join("logs");

    fs::create_dir_all(&model_dir)
        .map_err(|error| format!("failed to create managed core model directory: {error}"))?;
    fs::create_dir_all(&log_dir)
        .map_err(|error| format!("failed to create managed core log directory: {error}"))?;

    Ok(Some(ManagedCoreSidecarLaunchPlan {
        sidecar_path,
        data_dir,
        model_dir,
        log_dir,
        port: allocate_loopback_port()?,
    }))
}

fn resolve_core_sidecar_path(app_handle: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    if let Some(path) = parse_core_sidecar_arg(std::env::args().skip(1)) {
        return validate_sidecar_path(path).map(Some);
    }

    if let Some(path) = std::env::var_os(CORE_SIDECAR_ENV).map(PathBuf::from) {
        return validate_sidecar_path(path).map(Some);
    }

    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("nola-core")
                .join(core_sidecar_executable_name()),
        );
    }
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(
                parent
                    .join("nola-core")
                    .join(core_sidecar_executable_name()),
            );
        }
    }

    Ok(candidates.into_iter().find(|candidate| candidate.is_file()))
}

fn parse_core_sidecar_arg<I, S>(args: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut args = args.into_iter();
    while let Some(arg) = args.next() {
        let arg = arg.as_ref();
        if let Some(value) = arg.strip_prefix("--core-sidecar=") {
            return non_empty_path(value);
        }

        if arg == CORE_SIDECAR_ARG {
            return args.next().and_then(|value| non_empty_path(value.as_ref()));
        }
    }

    None
}

fn non_empty_path(value: &str) -> Option<PathBuf> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| PathBuf::from(trimmed))
}

fn validate_sidecar_path(path: PathBuf) -> Result<PathBuf, String> {
    if path.is_file() {
        return Ok(path);
    }

    Err(format!(
        "desktop core sidecar executable does not exist: {}",
        path.display()
    ))
}

fn allocate_loopback_port() -> Result<u16, String> {
    let listener = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0))
        .map_err(|error| format!("failed to allocate managed core port: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("failed to inspect managed core port: {error}"))?
        .port();
    Ok(port)
}

fn core_sidecar_executable_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "nola-core.exe"
    } else {
        "nola-core"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_core_sidecar_arg_accepts_equals_form() {
        assert_eq!(
            parse_core_sidecar_arg(["--core-sidecar=C:/Nola/nola-core.exe"]).unwrap(),
            PathBuf::from("C:/Nola/nola-core.exe")
        );
    }

    #[test]
    fn parse_core_sidecar_arg_accepts_separate_value() {
        assert_eq!(
            parse_core_sidecar_arg(["--core-sidecar", "C:/Nola/nola-core.exe"]).unwrap(),
            PathBuf::from("C:/Nola/nola-core.exe")
        );
    }

    #[test]
    fn parse_core_sidecar_arg_ignores_empty_value() {
        assert_eq!(parse_core_sidecar_arg(["--core-sidecar", "  "]), None);
    }
}
