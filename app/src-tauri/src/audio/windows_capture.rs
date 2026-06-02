use tauri::{AppHandle, Runtime};

use super::{
    capture_runtime::{CaptureControl, CaptureStartupSender},
    dto::{NativeAudioErrorCode, NativeAudioErrorDto, NativeCaptureSessionDto},
    registry::CaptureSessionRegistry,
};

#[cfg(target_os = "windows")]
mod platform {
    use std::{
        ffi::{c_void, OsStr},
        os::windows::ffi::OsStrExt,
        ptr::{addr_of, null_mut},
        thread,
        time::{Duration, Instant},
    };

    use windows::{
        core::{Error as WindowsError, GUID, PCWSTR},
        Win32::{
            Foundation::E_ACCESSDENIED,
            Media::Audio::{
                eCapture, eConsole, eRender, EDataFlow, IAudioCaptureClient, IAudioClient,
                IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT,
                AUDCLNT_E_DEVICE_INVALIDATED, AUDCLNT_E_ENDPOINT_CREATE_FAILED,
                AUDCLNT_E_SERVICE_NOT_RUNNING, AUDCLNT_E_UNSUPPORTED_FORMAT,
                AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, WAVEFORMATEX,
                WAVEFORMATEXTENSIBLE,
            },
            System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL},
        },
    };

    use crate::audio::{
        dto::NativeAudioSource,
        events,
        processing::{
            decode_interleaved_to_mono, CaptureSignalProcessor, NativeAudioProcessingError,
            NativeInputAudioFormat, NativeSampleFormat,
        },
        windows_com::ComApartment,
    };

    use super::*;

    const CAPTURE_POLL_INTERVAL: Duration = Duration::from_millis(10);
    const CAPTURE_BUFFER_DURATION_100NS: i64 = 1_000_000;
    const SYSTEM_SILENCE_LEVEL_INTERVAL: Duration = Duration::from_millis(100);
    const WAVE_FORMAT_PCM_TAG: u16 = 1;
    const WAVE_FORMAT_IEEE_FLOAT_TAG: u16 = 3;
    const WAVE_FORMAT_EXTENSIBLE_TAG: u16 = 0xfffe;

    pub fn spawn_capture_worker<R: Runtime + 'static>(
        app_handle: AppHandle<R>,
        registry: CaptureSessionRegistry,
        session: NativeCaptureSessionDto,
        control: CaptureControl,
        startup_sender: CaptureStartupSender,
    ) {
        thread::spawn(move || {
            let startup_result = WasapiCaptureSession::open(&session);

            match startup_result {
                Ok(mut capture_session) => {
                    let _ = startup_sender.send(Ok(()));
                    let result = capture_session.run(&app_handle, &session, &control);
                    control.mark_finished();

                    if let Err(error) = result {
                        if !control.is_stop_requested() {
                            emit_failed_state(&app_handle, &registry, &session.session_id, error);
                        }
                    }
                }
                Err(error) => {
                    let _ = startup_sender.send(Err(error));
                    control.mark_finished();
                }
            }
        });
    }

    struct WasapiCaptureSession {
        audio_client: IAudioClient,
        capture_client: IAudioCaptureClient,
        format: NativeInputAudioFormat,
        source: NativeAudioSource,
        _apartment: ComApartment,
    }

    impl WasapiCaptureSession {
        fn open(session: &NativeCaptureSessionDto) -> Result<Self, NativeAudioErrorDto> {
            let apartment =
                ComApartment::initialize().map_err(|_| NativeAudioErrorDto::capture_failed())?;

            unsafe {
                let enumerator: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                        .map_err(|error| map_windows_error_for_source(error, &session.source))?;
                let device =
                    get_capture_device(&enumerator, &session.source, session.device_id.as_deref())?;
                let audio_client: IAudioClient = device
                    .Activate(CLSCTX_ALL, None)
                    .map_err(|error| map_windows_error_for_source(error, &session.source))?;
                let mix_format = MixFormat::read(&audio_client, &session.source)?;

                audio_client
                    .Initialize(
                        AUDCLNT_SHAREMODE_SHARED,
                        stream_flags(&session.source),
                        CAPTURE_BUFFER_DURATION_100NS,
                        0,
                        mix_format.as_ptr(),
                        None,
                    )
                    .map_err(|error| map_windows_error_for_source(error, &session.source))?;

                let capture_client: IAudioCaptureClient = audio_client
                    .GetService()
                    .map_err(|error| map_windows_error_for_source(error, &session.source))?;
                audio_client
                    .Start()
                    .map_err(|error| map_windows_error_for_source(error, &session.source))?;

                Ok(Self {
                    audio_client,
                    capture_client,
                    format: mix_format.format(),
                    source: session.source.clone(),
                    _apartment: apartment,
                })
            }
        }

        fn run<R: Runtime>(
            &mut self,
            app_handle: &AppHandle<R>,
            session: &NativeCaptureSessionDto,
            control: &CaptureControl,
        ) -> Result<(), NativeAudioErrorDto> {
            let mut processor = CaptureSignalProcessor::new(
                session.session_id.clone(),
                session.source.clone(),
                self.format.sample_rate,
            );
            let mut last_system_silence_level = Instant::now();

            while !control.is_stop_requested() {
                thread::sleep(CAPTURE_POLL_INTERVAL);
                let mut emitted_packet = false;

                while self.next_packet_size()? > 0 {
                    emitted_packet = true;
                    let mono_samples = self.read_packet()?;

                    if !control.is_pause_requested() {
                        let events = processor.push_mono_samples(&mono_samples);
                        for frame in events.frames {
                            let _ = events::emit_audio_frame(app_handle, frame);
                        }
                        for level in events.levels {
                            let _ = events::emit_audio_level(app_handle, level);
                        }
                    }
                }

                if !emitted_packet
                    && self.source == NativeAudioSource::System
                    && !control.is_pause_requested()
                    && last_system_silence_level.elapsed() >= SYSTEM_SILENCE_LEVEL_INTERVAL
                {
                    let _ = events::emit_audio_level(app_handle, processor.silence_level());
                    last_system_silence_level = Instant::now();
                }
            }

            unsafe {
                self.audio_client
                    .Stop()
                    .map_err(|error| map_windows_error_for_source(error, &self.source))?;
            }
            Ok(())
        }

        fn next_packet_size(&self) -> Result<u32, NativeAudioErrorDto> {
            unsafe {
                self.capture_client
                    .GetNextPacketSize()
                    .map_err(|error| map_windows_error_for_source(error, &self.source))
            }
        }

        fn read_packet(&self) -> Result<Vec<f32>, NativeAudioErrorDto> {
            unsafe {
                let mut data = null_mut::<u8>();
                let mut frame_count = 0;
                let mut flags = 0;

                self.capture_client
                    .GetBuffer(&mut data, &mut frame_count, &mut flags, None, None)
                    .map_err(|error| map_windows_error_for_source(error, &self.source))?;

                let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0;
                let packet_len = frame_count as usize * self.format.block_align as usize;
                let decode_result = if silent {
                    decode_interleaved_to_mono(&[], frame_count, self.format, true)
                } else if data.is_null() {
                    Err(NativeAudioProcessingError::PacketTooShort)
                } else {
                    let packet = std::slice::from_raw_parts(data, packet_len);
                    decode_interleaved_to_mono(packet, frame_count, self.format, false)
                };

                self.capture_client
                    .ReleaseBuffer(frame_count)
                    .map_err(|error| map_windows_error_for_source(error, &self.source))?;

                decode_result.map_err(|_| NativeAudioErrorDto::capture_failed())
            }
        }
    }

    struct MixFormat {
        ptr: *mut WAVEFORMATEX,
        format: NativeInputAudioFormat,
    }

    impl MixFormat {
        unsafe fn read(
            audio_client: &IAudioClient,
            source: &NativeAudioSource,
        ) -> Result<Self, NativeAudioErrorDto> {
            let ptr = audio_client
                .GetMixFormat()
                .map_err(|error| map_windows_error_for_source(error, source))?;
            let format = parse_wave_format(ptr)?;
            Ok(Self { ptr, format })
        }

        fn as_ptr(&self) -> *const WAVEFORMATEX {
            self.ptr
        }

        fn format(&self) -> NativeInputAudioFormat {
            self.format
        }
    }

    impl Drop for MixFormat {
        fn drop(&mut self) {
            unsafe {
                CoTaskMemFree(Some(self.ptr.cast::<c_void>() as *const c_void));
            }
        }
    }

    unsafe fn parse_wave_format(
        ptr: *const WAVEFORMATEX,
    ) -> Result<NativeInputAudioFormat, NativeAudioErrorDto> {
        if ptr.is_null() {
            return Err(NativeAudioErrorDto::capture_failed());
        }

        let format_tag = addr_of!((*ptr).wFormatTag).read_unaligned();
        let sample_format = match format_tag {
            WAVE_FORMAT_PCM_TAG => NativeSampleFormat::Pcm,
            WAVE_FORMAT_IEEE_FLOAT_TAG => NativeSampleFormat::IeeeFloat,
            WAVE_FORMAT_EXTENSIBLE_TAG => read_extensible_sample_format(ptr)?,
            _ => return Err(NativeAudioErrorDto::capture_failed()),
        };

        NativeInputAudioFormat {
            sample_rate: addr_of!((*ptr).nSamplesPerSec).read_unaligned(),
            channel_count: addr_of!((*ptr).nChannels).read_unaligned(),
            bits_per_sample: addr_of!((*ptr).wBitsPerSample).read_unaligned(),
            block_align: addr_of!((*ptr).nBlockAlign).read_unaligned(),
            sample_format,
        }
        .validate()
        .map_err(|_| NativeAudioErrorDto::capture_failed())
    }

    unsafe fn read_extensible_sample_format(
        ptr: *const WAVEFORMATEX,
    ) -> Result<NativeSampleFormat, NativeAudioErrorDto> {
        let cb_size = addr_of!((*ptr).cbSize).read_unaligned();
        if usize::from(cb_size)
            < std::mem::size_of::<WAVEFORMATEXTENSIBLE>() - std::mem::size_of::<WAVEFORMATEX>()
        {
            return Err(NativeAudioErrorDto::capture_failed());
        }

        let extensible = ptr.cast::<WAVEFORMATEXTENSIBLE>();
        let sub_format = addr_of!((*extensible).SubFormat).read_unaligned();

        if sub_format == pcm_subformat() {
            Ok(NativeSampleFormat::Pcm)
        } else if sub_format == ieee_float_subformat() {
            Ok(NativeSampleFormat::IeeeFloat)
        } else {
            Err(NativeAudioErrorDto::capture_failed())
        }
    }

    unsafe fn get_capture_device(
        enumerator: &IMMDeviceEnumerator,
        source: &NativeAudioSource,
        device_id: Option<&str>,
    ) -> Result<IMMDevice, NativeAudioErrorDto> {
        if let Some(device_id) = device_id.filter(|value| !value.trim().is_empty()) {
            let wide_id = to_wide_null(device_id);
            return enumerator
                .GetDevice(PCWSTR(wide_id.as_ptr()))
                .map_err(|_| endpoint_unavailable(source));
        }

        enumerator
            .GetDefaultAudioEndpoint(data_flow(source), eConsole)
            .map_err(|_| endpoint_unavailable(source))
    }

    fn stream_flags(source: &NativeAudioSource) -> u32 {
        match source {
            NativeAudioSource::Microphone => 0,
            NativeAudioSource::System => AUDCLNT_STREAMFLAGS_LOOPBACK,
        }
    }

    fn data_flow(source: &NativeAudioSource) -> EDataFlow {
        match source {
            NativeAudioSource::Microphone => eCapture,
            NativeAudioSource::System => eRender,
        }
    }

    fn map_windows_error_for_source(
        error: WindowsError,
        source: &NativeAudioSource,
    ) -> NativeAudioErrorDto {
        let code = error.code();

        if code == E_ACCESSDENIED {
            return NativeAudioErrorDto::permission_denied();
        }

        if code == AUDCLNT_E_DEVICE_INVALIDATED {
            return NativeAudioErrorDto::device_disconnected();
        }

        if code == AUDCLNT_E_ENDPOINT_CREATE_FAILED {
            return endpoint_unavailable(source);
        }

        if code == AUDCLNT_E_UNSUPPORTED_FORMAT || code == AUDCLNT_E_SERVICE_NOT_RUNNING {
            return NativeAudioErrorDto::new(
                NativeAudioErrorCode::CaptureFailed,
                "Audio capture runtime is unavailable",
                true,
            );
        }

        NativeAudioErrorDto::capture_failed()
    }

    fn endpoint_unavailable(source: &NativeAudioSource) -> NativeAudioErrorDto {
        match source {
            NativeAudioSource::Microphone => NativeAudioErrorDto::device_not_found(),
            NativeAudioSource::System => NativeAudioErrorDto::system_audio_unavailable(),
        }
    }

    fn emit_failed_state<R: Runtime>(
        app_handle: &AppHandle<R>,
        registry: &CaptureSessionRegistry,
        session_id: &str,
        error: NativeAudioErrorDto,
    ) {
        if let Some(session) = registry.fail_session(session_id, error) {
            let _ = events::emit_capture_state(app_handle, session);
        }
    }

    fn to_wide_null(value: &str) -> Vec<u16> {
        OsStr::new(value).encode_wide().chain(Some(0)).collect()
    }

    fn pcm_subformat() -> GUID {
        GUID::from_u128(0x00000001_0000_0010_8000_00aa00389b71)
    }

    fn ieee_float_subformat() -> GUID {
        GUID::from_u128(0x00000003_0000_0010_8000_00aa00389b71)
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn stream_flags_enable_loopback_only_for_system_audio() {
            assert_eq!(stream_flags(&NativeAudioSource::Microphone), 0);
            assert_eq!(
                stream_flags(&NativeAudioSource::System),
                AUDCLNT_STREAMFLAGS_LOOPBACK
            );
        }

        #[test]
        fn wide_device_id_is_null_terminated() {
            let value = to_wide_null("device");

            assert_eq!(value.last(), Some(&0));
        }

        #[test]
        fn endpoint_lookup_errors_are_source_specific() {
            assert_eq!(
                endpoint_unavailable(&NativeAudioSource::Microphone),
                NativeAudioErrorDto::device_not_found()
            );
            assert_eq!(
                endpoint_unavailable(&NativeAudioSource::System),
                NativeAudioErrorDto::system_audio_unavailable()
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use std::thread;

    use super::*;

    pub fn spawn_capture_worker<R: Runtime + 'static>(
        _app_handle: AppHandle<R>,
        _registry: CaptureSessionRegistry,
        _session: NativeCaptureSessionDto,
        control: CaptureControl,
        startup_sender: CaptureStartupSender,
    ) {
        thread::spawn(move || {
            let _ = startup_sender.send(Err(NativeAudioErrorDto::new(
                NativeAudioErrorCode::CommandNotImplemented,
                "Native audio capture is unsupported on this platform",
                false,
            )));
            control.mark_finished();
        });
    }
}

pub use platform::spawn_capture_worker;
