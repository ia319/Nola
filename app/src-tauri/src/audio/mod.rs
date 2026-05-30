pub mod device_inventory;
pub mod dto;
pub mod events;
pub mod registry;
pub mod windows_devices;

pub use registry::CaptureSessionRegistry;
pub use windows_devices::list_native_audio_devices;

#[derive(Clone, Default)]
pub struct DesktopAudioState {
    registry: CaptureSessionRegistry,
}

impl DesktopAudioState {
    pub fn registry(&self) -> &CaptureSessionRegistry {
        &self.registry
    }

    pub fn release_active_sessions(&self) -> usize {
        self.registry.release_all()
    }
}
