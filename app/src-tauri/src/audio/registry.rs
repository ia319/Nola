use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use super::dto::{
    NativeAudioErrorDto, NativeAudioSource, NativeCaptureSessionDto, NativeCaptureState,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CaptureSessionStartDescriptor {
    pub session_id: String,
    pub source: NativeAudioSource,
    pub device_id: Option<String>,
    pub started_at_ms: u64,
}

#[derive(Clone, Default)]
pub struct CaptureSessionRegistry {
    sessions: Arc<Mutex<HashMap<String, NativeCaptureSessionDto>>>,
}

impl CaptureSessionRegistry {
    pub fn start_session(
        &self,
        descriptor: CaptureSessionStartDescriptor,
    ) -> Result<NativeCaptureSessionDto, NativeAudioErrorDto> {
        if descriptor.session_id.trim().is_empty() {
            return Err(NativeAudioErrorDto::session_id_invalid());
        }

        let mut sessions = self.lock_sessions();
        if let Some(existing_session) = sessions.get(&descriptor.session_id) {
            if existing_session.source != descriptor.source
                || existing_session.device_id != descriptor.device_id
            {
                return Err(NativeAudioErrorDto::session_params_mismatch());
            }

            return Ok(existing_session.clone());
        }

        let session = NativeCaptureSessionDto {
            session_id: descriptor.session_id,
            source: descriptor.source,
            device_id: descriptor.device_id,
            state: NativeCaptureState::Capturing,
            started_at_ms: descriptor.started_at_ms,
            error: None,
        };
        sessions.insert(session.session_id.clone(), session.clone());

        Ok(session)
    }

    pub fn pause_session(
        &self,
        session_id: &str,
    ) -> Result<NativeCaptureSessionDto, NativeAudioErrorDto> {
        let mut sessions = self.lock_sessions();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(NativeAudioErrorDto::session_not_found)?;

        match session.state {
            NativeCaptureState::Capturing => {
                session.state = NativeCaptureState::Paused;
                Ok(session.clone())
            }
            NativeCaptureState::Paused => Ok(session.clone()),
            _ => Err(NativeAudioErrorDto::session_state_invalid()),
        }
    }

    pub fn resume_session(
        &self,
        session_id: &str,
    ) -> Result<NativeCaptureSessionDto, NativeAudioErrorDto> {
        let mut sessions = self.lock_sessions();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(NativeAudioErrorDto::session_not_found)?;

        match session.state {
            NativeCaptureState::Paused => {
                session.state = NativeCaptureState::Capturing;
                Ok(session.clone())
            }
            NativeCaptureState::Capturing => Ok(session.clone()),
            _ => Err(NativeAudioErrorDto::session_state_invalid()),
        }
    }

    pub fn stop_session(&self, session_id: &str) -> Option<NativeCaptureSessionDto> {
        let mut sessions = self.lock_sessions();
        sessions.remove(session_id).map(|mut session| {
            session.state = NativeCaptureState::Stopped;
            session.error = None;
            session
        })
    }

    pub fn fail_session(
        &self,
        session_id: &str,
        error: NativeAudioErrorDto,
    ) -> Option<NativeCaptureSessionDto> {
        let mut sessions = self.lock_sessions();
        sessions.remove(session_id).map(|mut session| {
            session.state = NativeCaptureState::Failed;
            session.error = Some(error);
            session
        })
    }

    pub fn get_session(&self, session_id: &str) -> Option<NativeCaptureSessionDto> {
        self.lock_sessions().get(session_id).cloned()
    }

    pub fn active_session_count(&self) -> usize {
        self.lock_sessions().len()
    }

    pub fn release_all(&self) -> usize {
        let mut sessions = self.lock_sessions();
        let released_count = sessions.len();
        sessions.clear();
        released_count
    }

    fn lock_sessions(&self) -> std::sync::MutexGuard<'_, HashMap<String, NativeCaptureSessionDto>> {
        self.sessions
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn start_descriptor(
        session_id: &str,
        source: NativeAudioSource,
    ) -> CaptureSessionStartDescriptor {
        CaptureSessionStartDescriptor {
            session_id: session_id.to_string(),
            source,
            device_id: Some("device-1".to_string()),
            started_at_ms: 42,
        }
    }

    fn start_descriptor_with_device(
        session_id: &str,
        source: NativeAudioSource,
        device_id: Option<&str>,
    ) -> CaptureSessionStartDescriptor {
        CaptureSessionStartDescriptor {
            session_id: session_id.to_string(),
            source,
            device_id: device_id.map(str::to_string),
            started_at_ms: 42,
        }
    }

    #[test]
    fn start_session_returns_existing_session_for_matching_repeated_start() {
        let registry = CaptureSessionRegistry::default();

        let first = registry
            .start_session(start_descriptor("capture-1", NativeAudioSource::Microphone))
            .expect("session should start");
        let second = registry
            .start_session(start_descriptor("capture-1", NativeAudioSource::Microphone))
            .expect("repeated start should be idempotent");

        assert_eq!(first, second);
        assert_eq!(registry.active_session_count(), 1);
    }

    #[test]
    fn start_session_rejects_repeated_start_with_different_source() {
        let registry = CaptureSessionRegistry::default();
        registry
            .start_session(start_descriptor("capture-1", NativeAudioSource::Microphone))
            .expect("session should start");

        let error = registry
            .start_session(start_descriptor("capture-1", NativeAudioSource::System))
            .expect_err("conflicting source should fail");

        assert_eq!(error, NativeAudioErrorDto::session_params_mismatch());
        assert_eq!(registry.active_session_count(), 1);
    }

    #[test]
    fn start_session_rejects_repeated_start_with_different_device() {
        let registry = CaptureSessionRegistry::default();
        registry
            .start_session(start_descriptor_with_device(
                "capture-1",
                NativeAudioSource::Microphone,
                Some("device-1"),
            ))
            .expect("session should start");

        let error = registry
            .start_session(start_descriptor_with_device(
                "capture-1",
                NativeAudioSource::Microphone,
                Some("device-2"),
            ))
            .expect_err("conflicting device should fail");

        assert_eq!(error, NativeAudioErrorDto::session_params_mismatch());
        assert_eq!(registry.active_session_count(), 1);
    }

    #[test]
    fn pause_and_resume_are_idempotent_for_active_session() {
        let registry = CaptureSessionRegistry::default();
        registry
            .start_session(start_descriptor("capture-1", NativeAudioSource::Microphone))
            .expect("session should start");

        let paused = registry
            .pause_session("capture-1")
            .expect("session should pause");
        let paused_again = registry
            .pause_session("capture-1")
            .expect("pause should be idempotent");
        let resumed = registry
            .resume_session("capture-1")
            .expect("session should resume");
        let resumed_again = registry
            .resume_session("capture-1")
            .expect("resume should be idempotent");

        assert_eq!(paused.state, NativeCaptureState::Paused);
        assert_eq!(paused_again.state, NativeCaptureState::Paused);
        assert_eq!(resumed.state, NativeCaptureState::Capturing);
        assert_eq!(resumed_again.state, NativeCaptureState::Capturing);
    }

    #[test]
    fn stop_session_removes_session_and_repeated_stop_is_noop() {
        let registry = CaptureSessionRegistry::default();
        registry
            .start_session(start_descriptor("capture-1", NativeAudioSource::System))
            .expect("session should start");

        let stopped = registry
            .stop_session("capture-1")
            .expect("session should stop");
        let stopped_again = registry.stop_session("capture-1");

        assert_eq!(stopped.state, NativeCaptureState::Stopped);
        assert_eq!(stopped.source, NativeAudioSource::System);
        assert!(stopped_again.is_none());
        assert_eq!(registry.active_session_count(), 0);
    }

    #[test]
    fn release_all_clears_active_sessions() {
        let registry = CaptureSessionRegistry::default();
        registry
            .start_session(start_descriptor("capture-1", NativeAudioSource::Microphone))
            .expect("first session should start");
        registry
            .start_session(start_descriptor("capture-2", NativeAudioSource::System))
            .expect("second session should start");

        assert_eq!(registry.release_all(), 2);
        assert_eq!(registry.active_session_count(), 0);
        assert_eq!(registry.release_all(), 0);
    }

    #[test]
    fn fail_session_removes_session_with_failed_state() {
        let registry = CaptureSessionRegistry::default();
        registry
            .start_session(start_descriptor("capture-1", NativeAudioSource::Microphone))
            .expect("session should start");

        let failed = registry
            .fail_session("capture-1", NativeAudioErrorDto::device_disconnected())
            .expect("session should fail");

        assert_eq!(failed.state, NativeCaptureState::Failed);
        assert_eq!(
            failed.error,
            Some(NativeAudioErrorDto::device_disconnected())
        );
        assert_eq!(registry.active_session_count(), 0);
        assert!(registry
            .fail_session("capture-1", NativeAudioErrorDto::capture_failed())
            .is_none());
    }

    #[test]
    fn reject_empty_session_id() {
        let registry = CaptureSessionRegistry::default();
        let error = registry
            .start_session(start_descriptor(" ", NativeAudioSource::Microphone))
            .expect_err("empty session id should fail");

        assert_eq!(error, NativeAudioErrorDto::session_id_invalid());
    }
}
