pub mod capture_runtime;
pub mod device_inventory;
pub mod dto;
pub mod events;
pub mod processing;
pub mod registry;
pub mod windows_capture;
pub mod windows_com;
pub mod windows_devices;

pub use capture_runtime::NativeCaptureRuntime;
pub use registry::CaptureSessionRegistry;
pub use windows_devices::list_native_audio_devices;

#[derive(Clone, Default)]
pub struct DesktopAudioState {
    registry: CaptureSessionRegistry,
    runtime: NativeCaptureRuntime,
}

impl DesktopAudioState {
    pub fn registry(&self) -> &CaptureSessionRegistry {
        &self.registry
    }

    pub fn runtime(&self) -> &NativeCaptureRuntime {
        &self.runtime
    }

    pub fn release_active_sessions(&self) -> usize {
        self.runtime.release_all(&self.registry)
    }
}
