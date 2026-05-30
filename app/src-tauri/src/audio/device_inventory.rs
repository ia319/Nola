use super::dto::{
    NativeAudioCapabilitiesDto, NativeAudioDeviceDto, NativeAudioDeviceKind,
    NativeAudioInventoryDto, NativeCurrentDevicesDto, NativeDevicePermissionState,
    NativeDevicePermissionsDto, NativeDeviceUseStateDto, NativeDeviceWarningCode,
    NativeRuntimeCapabilityState,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeAudioEndpoint {
    pub id: String,
    pub kind: NativeAudioDeviceKind,
    pub label: Option<String>,
    pub is_default: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct NativeAudioEndpointInventory {
    pub microphones: Vec<NativeAudioEndpoint>,
    pub speakers: Vec<NativeAudioEndpoint>,
}

pub fn build_native_audio_inventory(
    current: NativeCurrentDevicesDto,
    endpoints: NativeAudioEndpointInventory,
) -> NativeAudioInventoryDto {
    let microphones = build_devices(endpoints.microphones, &current.microphone);
    let speakers = build_devices(endpoints.speakers, &current.speaker);
    let mut warnings = Vec::new();

    if microphones.is_empty() {
        warnings.push(NativeDeviceWarningCode::MicrophoneDeviceUnavailable);
    }

    if speakers.is_empty() {
        warnings.push(NativeDeviceWarningCode::SpeakerEnumerationUnsupported);
    }

    warnings.push(NativeDeviceWarningCode::DevicechangeUnsupported);

    NativeAudioInventoryDto {
        permissions: build_permissions(!microphones.is_empty(), !speakers.is_empty()),
        capabilities: build_capabilities(!microphones.is_empty(), !speakers.is_empty()),
        microphones,
        speakers,
        current,
        warnings,
    }
}

pub fn build_unsupported_native_audio_inventory(
    current: NativeCurrentDevicesDto,
    warning: NativeDeviceWarningCode,
) -> NativeAudioInventoryDto {
    NativeAudioInventoryDto {
        microphones: Vec::new(),
        speakers: Vec::new(),
        current,
        permissions: NativeDevicePermissionsDto {
            microphone: NativeDevicePermissionState::Unsupported,
            speaker_selection: NativeDevicePermissionState::Unsupported,
        },
        capabilities: NativeAudioCapabilitiesDto {
            microphone_capture: NativeRuntimeCapabilityState::Unsupported,
            speaker_selection: NativeRuntimeCapabilityState::Unsupported,
            system_audio_capture: NativeRuntimeCapabilityState::Unsupported,
        },
        warnings: vec![warning, NativeDeviceWarningCode::DevicechangeUnsupported],
    }
}

fn build_devices(
    endpoints: Vec<NativeAudioEndpoint>,
    state: &NativeDeviceUseStateDto,
) -> Vec<NativeAudioDeviceDto> {
    endpoints
        .into_iter()
        .map(|endpoint| NativeAudioDeviceDto {
            is_selected: state
                .selected_device_id
                .as_deref()
                .is_some_and(|selected_id| selected_id == endpoint.id),
            is_active: state
                .active_device_id
                .as_deref()
                .is_some_and(|active_id| active_id == endpoint.id),
            id: endpoint.id,
            kind: endpoint.kind,
            label: endpoint.label,
            is_default: endpoint.is_default,
        })
        .collect()
}

fn build_permissions(has_microphones: bool, has_speakers: bool) -> NativeDevicePermissionsDto {
    NativeDevicePermissionsDto {
        microphone: if has_microphones {
            NativeDevicePermissionState::Granted
        } else {
            NativeDevicePermissionState::Unsupported
        },
        speaker_selection: if has_speakers {
            NativeDevicePermissionState::Granted
        } else {
            NativeDevicePermissionState::Unsupported
        },
    }
}

fn build_capabilities(has_microphones: bool, has_speakers: bool) -> NativeAudioCapabilitiesDto {
    NativeAudioCapabilitiesDto {
        microphone_capture: if has_microphones {
            NativeRuntimeCapabilityState::Available
        } else {
            NativeRuntimeCapabilityState::Unsupported
        },
        speaker_selection: if has_speakers {
            NativeRuntimeCapabilityState::Available
        } else {
            NativeRuntimeCapabilityState::Unsupported
        },
        system_audio_capture: NativeRuntimeCapabilityState::NotImplemented,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn current_devices() -> NativeCurrentDevicesDto {
        NativeCurrentDevicesDto {
            microphone: NativeDeviceUseStateDto {
                selected_device_id: Some("mic-2".to_string()),
                active_device_id: Some("mic-1".to_string()),
            },
            speaker: NativeDeviceUseStateDto {
                selected_device_id: Some("speaker-1".to_string()),
                active_device_id: None,
            },
        }
    }

    #[test]
    fn build_inventory_marks_default_selected_and_active_devices() {
        let inventory = build_native_audio_inventory(
            current_devices(),
            NativeAudioEndpointInventory {
                microphones: vec![
                    NativeAudioEndpoint {
                        id: "mic-1".to_string(),
                        kind: NativeAudioDeviceKind::Microphone,
                        label: Some("Desk microphone".to_string()),
                        is_default: true,
                    },
                    NativeAudioEndpoint {
                        id: "mic-2".to_string(),
                        kind: NativeAudioDeviceKind::Microphone,
                        label: None,
                        is_default: false,
                    },
                ],
                speakers: vec![NativeAudioEndpoint {
                    id: "speaker-1".to_string(),
                    kind: NativeAudioDeviceKind::Speaker,
                    label: Some("Speakers".to_string()),
                    is_default: true,
                }],
            },
        );

        assert!(inventory.microphones[0].is_default);
        assert!(inventory.microphones[0].is_active);
        assert!(!inventory.microphones[0].is_selected);
        assert!(inventory.microphones[1].is_selected);
        assert!(inventory.speakers[0].is_selected);
        assert_eq!(
            inventory.capabilities.microphone_capture,
            NativeRuntimeCapabilityState::Available
        );
        assert_eq!(
            inventory.warnings,
            vec![NativeDeviceWarningCode::DevicechangeUnsupported]
        );
    }

    #[test]
    fn build_inventory_reports_empty_device_lists_with_stable_warnings() {
        let inventory =
            build_native_audio_inventory(NativeCurrentDevicesDto::default(), Default::default());

        assert!(inventory.microphones.is_empty());
        assert!(inventory.speakers.is_empty());
        assert_eq!(
            inventory.permissions.microphone,
            NativeDevicePermissionState::Unsupported
        );
        assert_eq!(
            inventory.capabilities.microphone_capture,
            NativeRuntimeCapabilityState::Unsupported
        );
        assert_eq!(
            inventory.warnings,
            vec![
                NativeDeviceWarningCode::MicrophoneDeviceUnavailable,
                NativeDeviceWarningCode::SpeakerEnumerationUnsupported,
                NativeDeviceWarningCode::DevicechangeUnsupported,
            ]
        );
    }
}
