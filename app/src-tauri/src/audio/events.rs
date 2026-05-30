use tauri::{AppHandle, Emitter, Runtime};

use super::dto::{
    NativeAudioFrameEventDto, NativeAudioLevelEventDto, NativeCaptureSessionDto,
    NATIVE_AUDIO_FRAME_EVENT, NATIVE_AUDIO_LEVEL_EVENT, NATIVE_AUDIO_STATE_EVENT,
};

pub fn emit_audio_frame<R: Runtime>(
    app_handle: &AppHandle<R>,
    payload: NativeAudioFrameEventDto,
) -> tauri::Result<()> {
    app_handle.emit(NATIVE_AUDIO_FRAME_EVENT, payload)
}

pub fn emit_audio_level<R: Runtime>(
    app_handle: &AppHandle<R>,
    payload: NativeAudioLevelEventDto,
) -> tauri::Result<()> {
    app_handle.emit(NATIVE_AUDIO_LEVEL_EVENT, payload)
}

pub fn emit_capture_state<R: Runtime>(
    app_handle: &AppHandle<R>,
    payload: NativeCaptureSessionDto,
) -> tauri::Result<()> {
    app_handle.emit(NATIVE_AUDIO_STATE_EVENT, payload)
}
