pub mod dto;
pub mod events;
pub mod registry;

pub use registry::CaptureSessionRegistry;

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
