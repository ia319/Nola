pub mod audio;

const NATIVE_AUDIO_SUPPORT_NOT_IMPLEMENTED: &str = "not_implemented";

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

fn build_desktop_runtime_info(app_version: String) -> DesktopRuntimeInfo {
    DesktopRuntimeInfo {
        platform: std::env::consts::OS,
        app_version,
        native_audio_support: NATIVE_AUDIO_SUPPORT_NOT_IMPLEMENTED,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_state = audio::DesktopAudioState::default();
    let window_audio_cleanup_state = audio_state.clone();
    let app_audio_cleanup_state = audio_state.clone();

    let app = tauri::Builder::default()
        .manage(audio_state)
        .on_window_event(move |_window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                window_audio_cleanup_state.release_active_sessions();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![desktop_runtime_info])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
            app_audio_cleanup_state.release_active_sessions();
        }
        _ => {}
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
        assert_eq!(info.native_audio_support, "not_implemented");
    }
}
