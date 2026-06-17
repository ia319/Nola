mod discovery;
mod process;
mod status;

use std::sync::{Arc, Mutex};

use discovery::build_launch_plan;
use process::{
    child_process_status, launch_managed_core_sidecar, ManagedCoreSidecarLaunchOutcome,
    ManagedCoreSidecarLaunchRetry, ManagedCoreSidecarRuntime,
};
pub use status::{
    DesktopCoreSidecarMode, DesktopCoreSidecarProcessStatus, DesktopCoreSidecarRuntimeStatus,
};

const MANAGED_CORE_SIDECAR_LAUNCH_ATTEMPTS: usize = 2;

#[derive(Clone)]
pub struct DesktopCoreSidecarState {
    inner: Arc<Mutex<DesktopCoreSidecarStateInner>>,
    launch_lock: Arc<tokio::sync::Mutex<()>>,
}

#[derive(Default)]
struct DesktopCoreSidecarStateInner {
    runtime: Option<ManagedCoreSidecarRuntime>,
}

impl DesktopCoreSidecarState {
    pub async fn ensure_managed_core_sidecar(
        &self,
        app_handle: &tauri::AppHandle,
    ) -> DesktopCoreSidecarRuntimeStatus {
        let _launch_guard = self.launch_lock.lock().await;
        if let Some(status) = self.reuse_running_backend() {
            return status;
        }

        let app_version = app_handle.package_info().version.to_string();
        let mut final_outcome: Option<ManagedCoreSidecarLaunchOutcome> = None;
        for attempt in 0..MANAGED_CORE_SIDECAR_LAUNCH_ATTEMPTS {
            let plan = match build_launch_plan(app_handle) {
                Ok(Some(plan)) => plan,
                Ok(None) => {
                    return DesktopCoreSidecarRuntimeStatus::unavailable(
                        "desktop core sidecar executable was not found",
                    );
                }
                Err(error) => {
                    return DesktopCoreSidecarRuntimeStatus::unavailable(error);
                }
            };
            let outcome = launch_managed_core_sidecar(plan, &app_version).await;
            let should_retry = outcome.retry == ManagedCoreSidecarLaunchRetry::Retryable
                && outcome.runtime.is_none()
                && attempt + 1 < MANAGED_CORE_SIDECAR_LAUNCH_ATTEMPTS;
            if should_retry {
                continue;
            }

            final_outcome = Some(outcome);
            break;
        }

        let ManagedCoreSidecarLaunchOutcome {
            runtime, status, ..
        } = final_outcome.expect("managed core sidecar launch attempts must run");
        let mut inner = self
            .inner
            .lock()
            .expect("desktop core sidecar state lock poisoned");
        inner.runtime = runtime;
        status
    }

    pub fn stop_all(&self) {
        let mut inner = self
            .inner
            .lock()
            .expect("desktop core sidecar state lock poisoned");
        if let Some(mut runtime) = inner.runtime.take() {
            runtime.stop();
        }
    }

    fn reuse_running_backend(&self) -> Option<DesktopCoreSidecarRuntimeStatus> {
        let mut inner = self
            .inner
            .lock()
            .expect("desktop core sidecar state lock poisoned");
        let runtime = inner.runtime.as_mut()?;
        let api_status = child_process_status(&mut runtime.api);
        if api_status != DesktopCoreSidecarProcessStatus::Available {
            let data_dir = runtime.data_dir.clone();
            let log_dir = runtime.log_dir.clone();
            if let Some(mut runtime) = inner.runtime.take() {
                runtime.stop();
            }
            let status = DesktopCoreSidecarRuntimeStatus::managed(
                None,
                api_status,
                DesktopCoreSidecarProcessStatus::Stopped,
                &data_dir,
                &log_dir,
                Some("managed core API process exited".to_string()),
            );
            return Some(status);
        }

        let worker_status = runtime
            .worker
            .as_mut()
            .map(child_process_status)
            .unwrap_or(DesktopCoreSidecarProcessStatus::Failed);
        let status = DesktopCoreSidecarRuntimeStatus::managed(
            Some(runtime.http_origin.clone()),
            api_status,
            worker_status,
            &runtime.data_dir,
            &runtime.log_dir,
            (worker_status != DesktopCoreSidecarProcessStatus::Available)
                .then(|| "managed core worker process is unavailable".to_string()),
        );
        Some(status)
    }
}

impl Default for DesktopCoreSidecarState {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(DesktopCoreSidecarStateInner::default())),
            launch_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }
}
