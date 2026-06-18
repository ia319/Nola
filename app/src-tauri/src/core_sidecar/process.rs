use std::{
    fs::OpenOptions,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};

use super::status::{DesktopCoreSidecarProcessStatus, DesktopCoreSidecarRuntimeStatus};

const CORE_CORS_ORIGINS: &str =
    "http://localhost:5173,http://127.0.0.1:5173,http://tauri.localhost,tauri://localhost";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(20);
const HEALTH_INTERVAL: Duration = Duration::from_millis(400);
const HEALTH_REQUEST_TIMEOUT: Duration = Duration::from_secs(2);
const CONTROLLED_CORE_ENV: &[&str] = &[
    "NOLA_CORS_ORIGINS",
    "NOLA_DATA_DIR",
    "NOLA_HOST",
    "NOLA_LIVE_REALTIME_TRANSCRIBER",
    "NOLA_MODEL_DIR",
    "NOLA_PORT",
];

pub(crate) struct ManagedCoreSidecarRuntime {
    pub(crate) api: Child,
    pub(crate) worker: Option<Child>,
    pub(crate) http_origin: String,
    pub(crate) data_dir: PathBuf,
    pub(crate) log_dir: PathBuf,
}

pub(crate) struct ManagedCoreSidecarLaunchPlan {
    pub(crate) sidecar_path: PathBuf,
    pub(crate) data_dir: PathBuf,
    pub(crate) model_dir: PathBuf,
    pub(crate) log_dir: PathBuf,
    pub(crate) port: u16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ManagedCoreSidecarLaunchRetry {
    Retryable,
    Final,
}

pub(crate) struct ManagedCoreSidecarLaunchOutcome {
    pub(crate) runtime: Option<ManagedCoreSidecarRuntime>,
    pub(crate) status: DesktopCoreSidecarRuntimeStatus,
    pub(crate) retry: ManagedCoreSidecarLaunchRetry,
}

impl ManagedCoreSidecarRuntime {
    pub(crate) fn stop(&mut self) {
        if let Some(worker) = self.worker.as_mut() {
            stop_child_process(worker);
        }
        stop_child_process(&mut self.api);
    }
}

pub(crate) async fn launch_managed_core_sidecar(
    plan: ManagedCoreSidecarLaunchPlan,
    expected_version: &str,
) -> ManagedCoreSidecarLaunchOutcome {
    let http_origin = format!("http://127.0.0.1:{}", plan.port);
    let api_args = vec![
        "api".to_string(),
        "--ignore-system-env".to_string(),
        "--data-dir".to_string(),
        path_to_string(&plan.data_dir),
        "--model-dir".to_string(),
        path_to_string(&plan.model_dir),
        "--host".to_string(),
        "127.0.0.1".to_string(),
        "--port".to_string(),
        plan.port.to_string(),
        "--cors-origins".to_string(),
        CORE_CORS_ORIGINS.to_string(),
    ];

    let mut api = match spawn_sidecar_process(
        &plan.sidecar_path,
        &api_args,
        &plan.log_dir.join("api.stdout.log"),
        &plan.log_dir.join("api.stderr.log"),
    ) {
        Ok(child) => child,
        Err(error) => {
            return ManagedCoreSidecarLaunchOutcome {
                runtime: None,
                status: DesktopCoreSidecarRuntimeStatus::managed(
                    Some(http_origin),
                    DesktopCoreSidecarProcessStatus::Failed,
                    DesktopCoreSidecarProcessStatus::NotStarted,
                    &plan.data_dir,
                    &plan.log_dir,
                    Some(error),
                ),
                retry: ManagedCoreSidecarLaunchRetry::Final,
            };
        }
    };

    if let Err(error) = wait_for_api_health(&mut api, &http_origin, expected_version).await {
        stop_child_process(&mut api);
        return ManagedCoreSidecarLaunchOutcome {
            runtime: None,
            status: DesktopCoreSidecarRuntimeStatus::managed(
                Some(http_origin),
                DesktopCoreSidecarProcessStatus::Failed,
                DesktopCoreSidecarProcessStatus::NotStarted,
                &plan.data_dir,
                &plan.log_dir,
                Some(error),
            ),
            retry: ManagedCoreSidecarLaunchRetry::Retryable,
        };
    }

    let worker_args = vec![
        "worker".to_string(),
        "--ignore-system-env".to_string(),
        "--data-dir".to_string(),
        path_to_string(&plan.data_dir),
        "--model-dir".to_string(),
        path_to_string(&plan.model_dir),
    ];
    let worker_result = spawn_sidecar_process(
        &plan.sidecar_path,
        &worker_args,
        &plan.log_dir.join("worker.stdout.log"),
        &plan.log_dir.join("worker.stderr.log"),
    );

    let (worker, worker_status, error) = match worker_result {
        Ok(child) => (
            Some(child),
            DesktopCoreSidecarProcessStatus::Available,
            None,
        ),
        Err(error) => (
            None,
            DesktopCoreSidecarProcessStatus::Failed,
            Some(format!("managed core worker failed to start: {error}")),
        ),
    };
    let status = DesktopCoreSidecarRuntimeStatus::managed(
        Some(http_origin.clone()),
        DesktopCoreSidecarProcessStatus::Available,
        worker_status,
        &plan.data_dir,
        &plan.log_dir,
        error,
    );
    let runtime = ManagedCoreSidecarRuntime {
        api,
        worker,
        http_origin,
        data_dir: plan.data_dir,
        log_dir: plan.log_dir,
    };

    ManagedCoreSidecarLaunchOutcome {
        runtime: Some(runtime),
        status,
        retry: ManagedCoreSidecarLaunchRetry::Final,
    }
}

fn spawn_sidecar_process(
    sidecar_path: &Path,
    args: &[String],
    stdout_path: &Path,
    stderr_path: &Path,
) -> Result<Child, String> {
    let stdout = append_log_file(stdout_path)?;
    let stderr = append_log_file(stderr_path)?;
    let mut command = Command::new(sidecar_path);
    command
        .args(args)
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    for key in CONTROLLED_CORE_ENV {
        command.env_remove(key);
    }
    #[cfg(windows)]
    apply_windows_process_options(&mut command);
    #[cfg(not(windows))]
    apply_process_options();
    command
        .spawn()
        .map_err(|error| format!("failed to spawn managed core sidecar: {error}"))
}

fn append_log_file(path: &Path) -> Result<std::fs::File, String> {
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("failed to open managed core log file: {error}"))
}

async fn wait_for_api_health(
    api: &mut Child,
    http_origin: &str,
    expected_version: &str,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(HEALTH_REQUEST_TIMEOUT)
        .build()
        .map_err(|error| format!("failed to create managed core health client: {error}"))?;
    let health_url = format!("{http_origin}/health");
    let deadline = Instant::now() + HEALTH_TIMEOUT;
    let mut last_error = "managed core API health check did not complete".to_string();

    while Instant::now() < deadline {
        match child_process_status(api) {
            DesktopCoreSidecarProcessStatus::Available => {}
            DesktopCoreSidecarProcessStatus::Stopped => {
                return Err("managed core API stopped before health check completed".to_string());
            }
            DesktopCoreSidecarProcessStatus::Failed => {
                return Err("managed core API failed before health check completed".to_string());
            }
            DesktopCoreSidecarProcessStatus::NotStarted => {
                return Err("managed core API did not start".to_string());
            }
        }

        match client.get(&health_url).send().await {
            Ok(response) if response.status().is_success() => {
                let payload = response
                    .text()
                    .await
                    .map_err(|error| format!("managed core health body read failed: {error}"))?;
                match serde_json::from_str::<HealthResponse>(&payload) {
                    Ok(health) if health.status == "ok" && health.version == expected_version => {
                        return Ok(());
                    }
                    Ok(health) => {
                        last_error = format!(
                            "managed core health returned status={} version={}",
                            health.status, health.version
                        );
                    }
                    Err(error) => {
                        last_error = format!("managed core health response was invalid: {error}");
                    }
                }
            }
            Ok(response) => {
                last_error = format!("managed core health returned HTTP {}", response.status());
            }
            Err(error) => {
                last_error = format!("managed core health request failed: {error}");
            }
        }

        tokio::time::sleep(HEALTH_INTERVAL).await;
    }

    Err(last_error)
}

pub(crate) fn child_process_status(child: &mut Child) -> DesktopCoreSidecarProcessStatus {
    match child.try_wait() {
        Ok(None) => DesktopCoreSidecarProcessStatus::Available,
        Ok(Some(status)) if status.success() => DesktopCoreSidecarProcessStatus::Stopped,
        Ok(Some(_)) | Err(_) => DesktopCoreSidecarProcessStatus::Failed,
    }
}

fn stop_child_process(child: &mut Child) {
    if matches!(child.try_wait(), Ok(Some(_))) {
        return;
    }

    let _ = child.kill();
    let _ = child.wait();
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(windows)]
fn apply_windows_process_options(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn apply_process_options() {
    // Add Unix process-group or session handling in this platform hook.
}

#[derive(serde::Deserialize)]
struct HealthResponse {
    status: String,
    version: String,
}
