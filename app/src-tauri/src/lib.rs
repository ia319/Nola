pub mod audio;
pub mod connection;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntimeInfo {
    platform: &'static str,
    app_version: String,
    native_audio_support: &'static str,
}

#[tauri::command]
fn desktop_runtime_info(app_handle: tauri::AppHandle) -> DesktopRuntimeInfo {
    build_desktop_runtime_info(app_handle.package_info().version.to_string())
}

#[tauri::command]
fn list_native_audio_devices(
    current: audio::dto::NativeCurrentDevicesDto,
) -> Result<audio::dto::NativeAudioInventoryDto, audio::dto::NativeAudioErrorDto> {
    audio::list_native_audio_devices(current)
}

#[tauri::command]
async fn start_native_microphone_capture(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, audio::DesktopAudioState>,
    request: audio::dto::NativeStartCaptureRequestDto,
) -> Result<audio::dto::NativeCaptureSessionDto, audio::dto::NativeAudioErrorDto> {
    start_native_capture(
        app_handle,
        state.inner().clone(),
        audio::dto::NativeAudioSource::Microphone,
        request,
    )
    .await
}

#[tauri::command]
async fn start_native_system_capture(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, audio::DesktopAudioState>,
    request: audio::dto::NativeStartCaptureRequestDto,
) -> Result<audio::dto::NativeCaptureSessionDto, audio::dto::NativeAudioErrorDto> {
    start_native_capture(
        app_handle,
        state.inner().clone(),
        audio::dto::NativeAudioSource::System,
        request,
    )
    .await
}

async fn start_native_capture(
    app_handle: tauri::AppHandle,
    state: audio::DesktopAudioState,
    source: audio::dto::NativeAudioSource,
    request: audio::dto::NativeStartCaptureRequestDto,
) -> Result<audio::dto::NativeCaptureSessionDto, audio::dto::NativeAudioErrorDto> {
    tauri::async_runtime::spawn_blocking(move || {
        state
            .runtime()
            .start_capture(app_handle, state.registry().clone(), source, request)
    })
    .await
    .unwrap_or_else(|_| Err(audio::dto::NativeAudioErrorDto::capture_failed()))
}

#[tauri::command]
fn pause_native_capture(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, audio::DesktopAudioState>,
    control: audio::dto::NativeCaptureSessionControlDto,
) -> Result<audio::dto::NativeCaptureSessionDto, audio::dto::NativeAudioErrorDto> {
    state
        .runtime()
        .pause_capture(&app_handle, state.registry(), &control.session_id)
}

#[tauri::command]
fn resume_native_capture(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, audio::DesktopAudioState>,
    control: audio::dto::NativeCaptureSessionControlDto,
) -> Result<audio::dto::NativeCaptureSessionDto, audio::dto::NativeAudioErrorDto> {
    state
        .runtime()
        .resume_capture(&app_handle, state.registry(), &control.session_id)
}

#[tauri::command]
fn stop_native_capture(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, audio::DesktopAudioState>,
    control: audio::dto::NativeCaptureSessionControlDto,
) -> Result<audio::dto::NativeCaptureSessionDto, audio::dto::NativeAudioErrorDto> {
    state
        .runtime()
        .stop_capture(&app_handle, state.registry(), &control.session_id)
}

fn build_desktop_runtime_info(app_version: String) -> DesktopRuntimeInfo {
    DesktopRuntimeInfo {
        platform: std::env::consts::OS,
        app_version,
        native_audio_support: native_audio_support(),
    }
}

#[cfg(target_os = "windows")]
fn native_audio_support() -> &'static str {
    "available"
}

#[cfg(not(target_os = "windows"))]
fn native_audio_support() -> &'static str {
    "unsupported"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_state = audio::DesktopAudioState::default();
    let app_audio_cleanup_state = audio_state.clone();
    let gateway_state = connection::gateway::DesktopGatewayState::default();

    let app = tauri::Builder::default()
        .manage(audio_state)
        .manage(gateway_state)
        .invoke_handler(tauri::generate_handler![
            desktop_runtime_info,
            connection::config::desktop_connection_runtime_options,
            connection::config::load_desktop_connection_config,
            connection::config::save_desktop_connection_config,
            connection::config::clear_desktop_connection_config,
            list_native_audio_devices,
            start_native_microphone_capture,
            start_native_system_capture,
            pause_native_capture,
            resume_native_capture,
            stop_native_capture
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Nola desktop application");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            // Native capture is app-global; window close events may be cancelled or target child windows.
            app_audio_cleanup_state.release_active_sessions();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_runtime_info_reports_static_shell_capabilities() {
        let info = build_desktop_runtime_info("0.1.0".to_string());

        assert_eq!(info.platform, std::env::consts::OS);
        assert_eq!(info.app_version, "0.1.0");

        #[cfg(target_os = "windows")]
        assert_eq!(info.native_audio_support, "available");

        #[cfg(not(target_os = "windows"))]
        assert_eq!(info.native_audio_support, "unsupported");
    }

    #[test]
    fn list_native_audio_devices_accepts_empty_current_state() {
        let current = audio::dto::NativeCurrentDevicesDto::default();
        let result = list_native_audio_devices(current.clone());

        match result {
            Ok(inventory) => {
                assert_eq!(inventory.current, current);
            }
            Err(error) => {
                assert_eq!(error.code, audio::dto::NativeAudioErrorCode::InternalError);
            }
        }
    }
}
