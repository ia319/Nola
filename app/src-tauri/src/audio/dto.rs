pub const NATIVE_AUDIO_ENCODING: &str = "pcm_s16le";
pub const NATIVE_AUDIO_SAMPLE_RATE: u32 = 16_000;
pub const NATIVE_AUDIO_CHANNEL_COUNT: u16 = 1;
pub const NATIVE_AUDIO_FRAME_DURATION_MS: u32 = 20;
pub const NATIVE_AUDIO_LEVEL_INTERVAL_MS: u32 = 100;
pub const NATIVE_AUDIO_FRAME_EVENT: &str = "native_audio_frame";
pub const NATIVE_AUDIO_LEVEL_EVENT: &str = "native_audio_level";
pub const NATIVE_AUDIO_STATE_EVENT: &str = "native_audio_state";

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeAudioDeviceKind {
    Microphone,
    Speaker,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeAudioSource {
    Microphone,
    System,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeRuntimeCapabilityState {
    Available,
    Limited,
    Unsupported,
    NotImplemented,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeDevicePermissionState {
    Granted,
    Prompt,
    Denied,
    Unsupported,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeDeviceWarningCode {
    MicrophonePermissionRequired,
    MicrophonePermissionDenied,
    MicrophoneDeviceUnavailable,
    MicrophoneHardwareUnavailable,
    SpeakerEnumerationUnsupported,
    SpeakerLabelsHidden,
    SpeakerSelectionUnsupported,
    SystemAudioCaptureLimited,
    MediaDevicesUnsupported,
    DevicechangeUnsupported,
    InsecureContext,
    TauriDeviceInventoryNotImplemented,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioDeviceDto {
    pub id: String,
    pub kind: NativeAudioDeviceKind,
    pub label: Option<String>,
    pub is_default: bool,
    pub is_selected: bool,
    pub is_active: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDeviceUseStateDto {
    pub selected_device_id: Option<String>,
    pub active_device_id: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCurrentDevicesDto {
    pub microphone: NativeDeviceUseStateDto,
    pub speaker: NativeDeviceUseStateDto,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDevicePermissionsDto {
    pub microphone: NativeDevicePermissionState,
    pub speaker_selection: NativeDevicePermissionState,
}

impl Default for NativeDevicePermissionsDto {
    fn default() -> Self {
        Self {
            microphone: NativeDevicePermissionState::Unknown,
            speaker_selection: NativeDevicePermissionState::Unsupported,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioCapabilitiesDto {
    pub microphone_capture: NativeRuntimeCapabilityState,
    pub speaker_selection: NativeRuntimeCapabilityState,
    pub system_audio_capture: NativeRuntimeCapabilityState,
}

impl Default for NativeAudioCapabilitiesDto {
    fn default() -> Self {
        Self {
            microphone_capture: NativeRuntimeCapabilityState::NotImplemented,
            speaker_selection: NativeRuntimeCapabilityState::NotImplemented,
            system_audio_capture: NativeRuntimeCapabilityState::NotImplemented,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioInventoryDto {
    pub microphones: Vec<NativeAudioDeviceDto>,
    pub speakers: Vec<NativeAudioDeviceDto>,
    pub current: NativeCurrentDevicesDto,
    pub permissions: NativeDevicePermissionsDto,
    pub capabilities: NativeAudioCapabilitiesDto,
    pub warnings: Vec<NativeDeviceWarningCode>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeCaptureState {
    Idle,
    Starting,
    Capturing,
    Paused,
    Stopping,
    Stopped,
    Failed,
    Unsupported,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCaptureSessionDto {
    pub session_id: String,
    pub source: NativeAudioSource,
    pub device_id: Option<String>,
    pub state: NativeCaptureState,
    pub started_at_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioFrameEventDto {
    pub session_id: String,
    pub source: NativeAudioSource,
    pub sequence: u64,
    pub sample_rate: u32,
    pub channel_count: u16,
    pub encoding: String,
    pub duration_ms: u32,
    pub captured_at_ms: u64,
    pub payload: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioLevelEventDto {
    pub session_id: String,
    pub source: NativeAudioSource,
    pub level: f32,
    pub peak: f32,
    pub is_muted_like: bool,
    pub measured_at_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeAudioErrorCode {
    CommandNotImplemented,
    SessionIdInvalid,
    SessionParamsMismatch,
    SessionNotFound,
    SessionStateInvalid,
    DeviceNotFound,
    PermissionDenied,
    CaptureFailed,
    InternalError,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioErrorDto {
    pub code: NativeAudioErrorCode,
    pub message: String,
    pub retryable: bool,
}

impl NativeAudioErrorDto {
    pub fn new(code: NativeAudioErrorCode, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            retryable,
        }
    }

    pub fn session_id_invalid() -> Self {
        Self::new(
            NativeAudioErrorCode::SessionIdInvalid,
            "Capture session id is invalid",
            false,
        )
    }

    pub fn session_not_found() -> Self {
        Self::new(
            NativeAudioErrorCode::SessionNotFound,
            "Capture session was not found",
            false,
        )
    }

    pub fn session_params_mismatch() -> Self {
        Self::new(
            NativeAudioErrorCode::SessionParamsMismatch,
            "Capture session parameters do not match the active session",
            false,
        )
    }

    pub fn session_state_invalid() -> Self {
        Self::new(
            NativeAudioErrorCode::SessionStateInvalid,
            "Capture session state is invalid",
            false,
        )
    }
}

impl NativeAudioFrameEventDto {
    pub fn pcm16le(
        session_id: String,
        source: NativeAudioSource,
        sequence: u64,
        duration_ms: u32,
        captured_at_ms: u64,
        payload: Vec<u8>,
    ) -> Self {
        Self {
            session_id,
            source,
            sequence,
            sample_rate: NATIVE_AUDIO_SAMPLE_RATE,
            channel_count: NATIVE_AUDIO_CHANNEL_COUNT,
            encoding: NATIVE_AUDIO_ENCODING.to_string(),
            duration_ms,
            captured_at_ms,
            payload,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_inventory_reports_not_implemented_capabilities() {
        let inventory = NativeAudioInventoryDto::default();

        assert!(inventory.microphones.is_empty());
        assert!(inventory.speakers.is_empty());
        assert_eq!(
            inventory.capabilities.microphone_capture,
            NativeRuntimeCapabilityState::NotImplemented
        );
        assert_eq!(
            inventory.capabilities.system_audio_capture,
            NativeRuntimeCapabilityState::NotImplemented
        );
    }

    #[test]
    fn pcm16le_frame_event_uses_realtime_audio_contract() {
        let frame = NativeAudioFrameEventDto::pcm16le(
            "capture-1".to_string(),
            NativeAudioSource::Microphone,
            7,
            NATIVE_AUDIO_FRAME_DURATION_MS,
            42,
            vec![1, 2, 3, 4],
        );

        assert_eq!(frame.sample_rate, NATIVE_AUDIO_SAMPLE_RATE);
        assert_eq!(frame.channel_count, NATIVE_AUDIO_CHANNEL_COUNT);
        assert_eq!(frame.encoding, NATIVE_AUDIO_ENCODING);
        assert_eq!(frame.duration_ms, NATIVE_AUDIO_FRAME_DURATION_MS);
        assert_eq!(frame.payload, vec![1, 2, 3, 4]);
    }
}
