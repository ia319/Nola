use super::dto::{NativeAudioErrorDto, NativeAudioInventoryDto, NativeCurrentDevicesDto};

#[cfg(target_os = "windows")]
mod platform {
    use std::ffi::c_void;

    use windows::{
        core::PWSTR,
        Win32::{
            Devices::FunctionDiscovery::PKEY_Device_FriendlyName,
            Media::Audio::{
                eCapture, eConsole, eRender, EDataFlow, IMMDevice, IMMDeviceEnumerator,
                MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
            },
            System::Com::StructuredStorage::{
                PropVariantClear, PropVariantToStringAlloc, PROPVARIANT,
            },
            System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL, STGM_READ},
        },
    };

    use crate::audio::{
        device_inventory::{
            build_native_audio_inventory, NativeAudioEndpoint, NativeAudioEndpointInventory,
        },
        dto::{NativeAudioDeviceKind, NativeAudioErrorCode},
        windows_com::ComApartment,
    };

    use super::*;

    pub fn list_native_audio_devices(
        current: NativeCurrentDevicesDto,
    ) -> Result<NativeAudioInventoryDto, NativeAudioErrorDto> {
        let endpoints = enumerate_windows_audio_endpoints().map_err(|_| enumeration_failed())?;
        Ok(build_native_audio_inventory(current, endpoints))
    }

    fn enumerate_windows_audio_endpoints() -> Result<NativeAudioEndpointInventory, ()> {
        let _apartment = ComApartment::initialize().map_err(|_| ())?;

        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|_| ())?;

            Ok(NativeAudioEndpointInventory {
                microphones: enumerate_endpoints(
                    &enumerator,
                    eCapture,
                    NativeAudioDeviceKind::Microphone,
                )?,
                speakers: enumerate_endpoints(
                    &enumerator,
                    eRender,
                    NativeAudioDeviceKind::Speaker,
                )?,
            })
        }
    }

    unsafe fn enumerate_endpoints(
        enumerator: &IMMDeviceEnumerator,
        dataflow: EDataFlow,
        kind: NativeAudioDeviceKind,
    ) -> Result<Vec<NativeAudioEndpoint>, ()> {
        let default_id = get_default_endpoint_id(enumerator, dataflow);
        let collection = enumerator
            .EnumAudioEndpoints(dataflow, DEVICE_STATE_ACTIVE)
            .map_err(|_| ())?;
        let count = collection.GetCount().map_err(|_| ())?;
        let mut endpoints = Vec::with_capacity(count as usize);

        for index in 0..count {
            let device = collection.Item(index).map_err(|_| ())?;
            let id = get_device_id(&device).ok_or(())?;

            endpoints.push(NativeAudioEndpoint {
                is_default: default_id.as_deref().is_some_and(|value| value == id),
                label: get_device_label(&device),
                id,
                kind: kind.clone(),
            });
        }

        Ok(endpoints)
    }

    unsafe fn get_default_endpoint_id(
        enumerator: &IMMDeviceEnumerator,
        dataflow: EDataFlow,
    ) -> Option<String> {
        let device = enumerator
            .GetDefaultAudioEndpoint(dataflow, eConsole)
            .ok()?;
        get_device_id(&device)
    }

    unsafe fn get_device_id(device: &IMMDevice) -> Option<String> {
        let id = device.GetId().ok()?;
        take_pwstr(id)
    }

    unsafe fn get_device_label(device: &IMMDevice) -> Option<String> {
        let property_store = device.OpenPropertyStore(STGM_READ).ok()?;
        let mut value = property_store.GetValue(&PKEY_Device_FriendlyName).ok()?;
        let label = propvariant_to_string(&value);
        let _ = PropVariantClear(&mut value as *mut PROPVARIANT);
        label
    }

    unsafe fn propvariant_to_string(value: &PROPVARIANT) -> Option<String> {
        let label = PropVariantToStringAlloc(value as *const PROPVARIANT).ok()?;
        take_pwstr(label)
    }

    unsafe fn take_pwstr(value: PWSTR) -> Option<String> {
        if value.is_null() {
            return None;
        }

        let text = value.to_string().ok().and_then(normalize_label);
        CoTaskMemFree(Some(value.as_ptr().cast::<c_void>() as *const c_void));
        text
    }

    fn normalize_label(value: String) -> Option<String> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }

    fn enumeration_failed() -> NativeAudioErrorDto {
        NativeAudioErrorDto::new(
            NativeAudioErrorCode::InternalError,
            "Audio device enumeration failed",
            true,
        )
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn normalize_label_drops_blank_labels() {
            assert_eq!(
                normalize_label("  Microphone  ".to_string()),
                Some("Microphone".to_string())
            );
            assert_eq!(normalize_label("   ".to_string()), None);
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use crate::audio::{
        device_inventory::build_unsupported_native_audio_inventory, dto::NativeDeviceWarningCode,
    };

    use super::*;

    pub fn list_native_audio_devices(
        current: NativeCurrentDevicesDto,
    ) -> Result<NativeAudioInventoryDto, NativeAudioErrorDto> {
        Ok(build_unsupported_native_audio_inventory(
            current,
            NativeDeviceWarningCode::MediaDevicesUnsupported,
        ))
    }
}

pub use platform::list_native_audio_devices;
