use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    time::Duration,
};

use tauri::{AppHandle, Runtime};

use super::{
    dto::{
        NativeAudioErrorDto, NativeAudioSource, NativeCaptureSessionDto,
        NativeStartCaptureRequestDto,
    },
    events,
    registry::{CaptureSessionRegistry, CaptureSessionStartDescriptor},
    windows_capture,
};

const CAPTURE_START_TIMEOUT: Duration = Duration::from_secs(5);

pub type CaptureStartupSender = mpsc::Sender<Result<(), NativeAudioErrorDto>>;

#[derive(Clone, Default)]
pub struct NativeCaptureRuntime {
    handles: Arc<Mutex<HashMap<String, CaptureWorkerHandle>>>,
}

impl NativeCaptureRuntime {
    pub fn start_capture<R: Runtime + 'static>(
        &self,
        app_handle: AppHandle<R>,
        registry: CaptureSessionRegistry,
        source: NativeAudioSource,
        request: NativeStartCaptureRequestDto,
    ) -> Result<NativeCaptureSessionDto, NativeAudioErrorDto> {
        let descriptor = CaptureSessionStartDescriptor {
            session_id: request.session_id,
            source,
            device_id: request.device_id,
            started_at_ms: now_epoch_ms(),
        };

        self.prune_finished_session(&descriptor.session_id);
        if self.has_session(&descriptor.session_id) {
            return registry.start_session(descriptor);
        }

        let session = registry.start_session(descriptor)?;
        let control = CaptureControl::default();
        let (startup_sender, startup_receiver) = mpsc::channel();

        windows_capture::spawn_capture_worker(
            app_handle.clone(),
            registry.clone(),
            session.clone(),
            control.clone(),
            startup_sender,
        );

        match startup_receiver.recv_timeout(CAPTURE_START_TIMEOUT) {
            Ok(Ok(())) => {
                self.insert_handle(session.session_id.clone(), control);
                let _ = events::emit_capture_state(&app_handle, session.clone());
                Ok(session)
            }
            Ok(Err(error)) => {
                control.request_stop();
                let _ = registry.stop_session(&session.session_id);
                Err(error)
            }
            Err(_) => {
                control.request_stop();
                let _ = registry.stop_session(&session.session_id);
                Err(NativeAudioErrorDto::capture_failed())
            }
        }
    }

    pub fn pause_capture<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        registry: &CaptureSessionRegistry,
        session_id: &str,
    ) -> Result<NativeCaptureSessionDto, NativeAudioErrorDto> {
        let control = self
            .get_control(session_id)
            .ok_or_else(NativeAudioErrorDto::session_not_found)?;
        let session = registry.pause_session(session_id)?;
        control.request_pause();
        let _ = events::emit_capture_state(app_handle, session.clone());
        Ok(session)
    }

    pub fn resume_capture<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        registry: &CaptureSessionRegistry,
        session_id: &str,
    ) -> Result<NativeCaptureSessionDto, NativeAudioErrorDto> {
        let control = self
            .get_control(session_id)
            .ok_or_else(NativeAudioErrorDto::session_not_found)?;
        let session = registry.resume_session(session_id)?;
        control.request_resume();
        let _ = events::emit_capture_state(app_handle, session.clone());
        Ok(session)
    }

    pub fn stop_capture<R: Runtime>(
        &self,
        app_handle: &AppHandle<R>,
        registry: &CaptureSessionRegistry,
        session_id: &str,
    ) -> Result<NativeCaptureSessionDto, NativeAudioErrorDto> {
        let control = self.take_control(session_id);
        let session = registry
            .stop_session(session_id)
            .ok_or_else(NativeAudioErrorDto::session_not_found)?;

        if let Some(control) = control {
            control.request_stop();
        }

        let _ = events::emit_capture_state(app_handle, session.clone());
        Ok(session)
    }

    pub fn release_all(&self, registry: &CaptureSessionRegistry) -> usize {
        let controls = {
            let mut handles = self.lock_handles();
            handles
                .drain()
                .map(|(_, handle)| handle.control)
                .collect::<Vec<_>>()
        };

        for control in controls {
            control.request_stop();
        }

        registry.release_all()
    }

    fn has_session(&self, session_id: &str) -> bool {
        self.lock_handles().contains_key(session_id)
    }

    fn insert_handle(&self, session_id: String, control: CaptureControl) {
        self.lock_handles()
            .insert(session_id, CaptureWorkerHandle { control });
    }

    fn get_control(&self, session_id: &str) -> Option<CaptureControl> {
        self.lock_handles()
            .get(session_id)
            .map(|handle| handle.control.clone())
    }

    fn take_control(&self, session_id: &str) -> Option<CaptureControl> {
        self.lock_handles()
            .remove(session_id)
            .map(|handle| handle.control)
    }

    fn prune_finished_session(&self, session_id: &str) {
        let mut handles = self.lock_handles();
        if handles
            .get(session_id)
            .is_some_and(|handle| handle.control.is_finished())
        {
            handles.remove(session_id);
        }
    }

    fn lock_handles(&self) -> std::sync::MutexGuard<'_, HashMap<String, CaptureWorkerHandle>> {
        self.handles
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }
}

struct CaptureWorkerHandle {
    control: CaptureControl,
}

#[derive(Clone, Default)]
pub struct CaptureControl {
    stop_requested: Arc<AtomicBool>,
    pause_requested: Arc<AtomicBool>,
    finished: Arc<AtomicBool>,
}

impl CaptureControl {
    pub fn request_stop(&self) {
        self.stop_requested.store(true, Ordering::SeqCst);
    }

    pub fn request_pause(&self) {
        self.pause_requested.store(true, Ordering::SeqCst);
    }

    pub fn request_resume(&self) {
        self.pause_requested.store(false, Ordering::SeqCst);
    }

    pub fn is_stop_requested(&self) -> bool {
        self.stop_requested.load(Ordering::SeqCst)
    }

    pub fn is_pause_requested(&self) -> bool {
        self.pause_requested.load(Ordering::SeqCst)
    }

    pub fn mark_finished(&self) {
        self.finished.store(true, Ordering::SeqCst);
    }

    fn is_finished(&self) -> bool {
        self.finished.load(Ordering::SeqCst)
    }
}

fn now_epoch_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capture_control_tracks_pause_stop_and_finished_flags() {
        let control = CaptureControl::default();

        assert!(!control.is_stop_requested());
        assert!(!control.is_pause_requested());

        control.request_pause();
        assert!(control.is_pause_requested());

        control.request_resume();
        assert!(!control.is_pause_requested());

        control.request_stop();
        control.mark_finished();
        assert!(control.is_stop_requested());
        assert!(control.is_finished());
    }

    #[test]
    fn release_all_signals_controls_and_clears_registry() {
        let runtime = NativeCaptureRuntime::default();
        let registry = CaptureSessionRegistry::default();
        let control = CaptureControl::default();

        registry
            .start_session(CaptureSessionStartDescriptor {
                session_id: "capture-1".to_string(),
                source: NativeAudioSource::Microphone,
                device_id: None,
                started_at_ms: 1,
            })
            .expect("session should start");
        runtime.insert_handle("capture-1".to_string(), control.clone());

        assert_eq!(runtime.release_all(&registry), 1);
        assert!(control.is_stop_requested());
        assert_eq!(registry.active_session_count(), 0);
        assert!(!runtime.has_session("capture-1"));
    }

    #[test]
    fn prune_finished_session_removes_stale_handle() {
        let runtime = NativeCaptureRuntime::default();
        let control = CaptureControl::default();
        runtime.insert_handle("capture-1".to_string(), control.clone());

        control.mark_finished();
        runtime.prune_finished_session("capture-1");

        assert!(!runtime.has_session("capture-1"));
    }
}
