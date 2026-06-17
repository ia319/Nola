use std::path::Path;

#[derive(Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopCoreSidecarMode {
    ManagedLocal,
    ExternalLocal,
    Remote,
    Unavailable,
}

#[derive(Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesktopCoreSidecarProcessStatus {
    NotStarted,
    Available,
    Failed,
    Stopped,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCoreSidecarRuntimeStatus {
    mode: DesktopCoreSidecarMode,
    http_origin: Option<String>,
    api_status: DesktopCoreSidecarProcessStatus,
    worker_status: DesktopCoreSidecarProcessStatus,
    data_dir: Option<String>,
    log_dir: Option<String>,
    error: Option<String>,
}

impl DesktopCoreSidecarRuntimeStatus {
    pub fn external_local() -> Self {
        Self {
            mode: DesktopCoreSidecarMode::ExternalLocal,
            http_origin: None,
            api_status: DesktopCoreSidecarProcessStatus::NotStarted,
            worker_status: DesktopCoreSidecarProcessStatus::NotStarted,
            data_dir: None,
            log_dir: None,
            error: None,
        }
    }

    pub fn remote() -> Self {
        Self {
            mode: DesktopCoreSidecarMode::Remote,
            http_origin: None,
            api_status: DesktopCoreSidecarProcessStatus::NotStarted,
            worker_status: DesktopCoreSidecarProcessStatus::NotStarted,
            data_dir: None,
            log_dir: None,
            error: None,
        }
    }

    pub fn unavailable(error: impl Into<String>) -> Self {
        Self {
            mode: DesktopCoreSidecarMode::Unavailable,
            http_origin: None,
            api_status: DesktopCoreSidecarProcessStatus::Failed,
            worker_status: DesktopCoreSidecarProcessStatus::NotStarted,
            data_dir: None,
            log_dir: None,
            error: Some(error.into()),
        }
    }

    pub(crate) fn managed(
        http_origin: Option<String>,
        api_status: DesktopCoreSidecarProcessStatus,
        worker_status: DesktopCoreSidecarProcessStatus,
        data_dir: &Path,
        log_dir: &Path,
        error: Option<String>,
    ) -> Self {
        Self {
            mode: DesktopCoreSidecarMode::ManagedLocal,
            http_origin,
            api_status,
            worker_status,
            data_dir: Some(path_to_string(data_dir)),
            log_dir: Some(path_to_string(log_dir)),
            error,
        }
    }

    pub fn managed_http_origin(&self) -> Option<String> {
        if self.mode == DesktopCoreSidecarMode::ManagedLocal
            && self.api_status == DesktopCoreSidecarProcessStatus::Available
        {
            return self.http_origin.clone();
        }

        None
    }
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    #[test]
    fn managed_status_exposes_origin_only_after_api_available() {
        let unavailable = DesktopCoreSidecarRuntimeStatus::unavailable("missing sidecar");
        assert_eq!(unavailable.managed_http_origin(), None);

        let managed = DesktopCoreSidecarRuntimeStatus::managed(
            Some("http://127.0.0.1:18123".to_string()),
            DesktopCoreSidecarProcessStatus::Available,
            DesktopCoreSidecarProcessStatus::Available,
            Path::new("data"),
            Path::new("logs"),
            None,
        );
        assert_eq!(
            managed.managed_http_origin().as_deref(),
            Some("http://127.0.0.1:18123")
        );
    }
}
