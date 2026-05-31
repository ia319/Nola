use super::dto::{
    NativeAudioFrameEventDto, NativeAudioLevelEventDto, NativeAudioSource,
    NATIVE_AUDIO_FRAME_DURATION_MS, NATIVE_AUDIO_LEVEL_INTERVAL_MS, NATIVE_AUDIO_SAMPLE_RATE,
};

const DEFAULT_MUTED_THRESHOLD: f32 = 0.015;
const PCM_8BIT_MIDPOINT: f32 = 128.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NativeSampleFormat {
    Pcm,
    IeeeFloat,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NativeInputAudioFormat {
    pub sample_rate: u32,
    pub channel_count: u16,
    pub bits_per_sample: u16,
    pub block_align: u16,
    pub sample_format: NativeSampleFormat,
}

impl NativeInputAudioFormat {
    pub fn validate(self) -> Result<Self, NativeAudioProcessingError> {
        if self.sample_rate == 0 || self.channel_count == 0 || self.block_align == 0 {
            return Err(NativeAudioProcessingError::UnsupportedFormat);
        }

        match (self.sample_format, self.bits_per_sample) {
            (NativeSampleFormat::Pcm, 8 | 16 | 24 | 32) => Ok(self),
            (NativeSampleFormat::IeeeFloat, 32 | 64) => Ok(self),
            _ => Err(NativeAudioProcessingError::UnsupportedFormat),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NativeAudioProcessingError {
    UnsupportedFormat,
    PacketTooShort,
}

pub struct CaptureSignalProcessor {
    session_id: String,
    source: NativeAudioSource,
    resampler: LinearResampler,
    frame_buffer: Vec<f32>,
    level_buffer: Vec<f32>,
    frame_sample_count: usize,
    level_sample_count: usize,
    sequence: u64,
    emitted_samples: u64,
}

impl CaptureSignalProcessor {
    pub fn new(session_id: String, source: NativeAudioSource, input_sample_rate: u32) -> Self {
        Self {
            session_id,
            source,
            resampler: LinearResampler::new(input_sample_rate, NATIVE_AUDIO_SAMPLE_RATE),
            frame_buffer: Vec::new(),
            level_buffer: Vec::new(),
            frame_sample_count: samples_for_duration(NATIVE_AUDIO_FRAME_DURATION_MS),
            level_sample_count: samples_for_duration(NATIVE_AUDIO_LEVEL_INTERVAL_MS),
            sequence: 0,
            emitted_samples: 0,
        }
    }

    pub fn push_mono_samples(&mut self, samples: &[f32]) -> ProcessedNativeAudioEvents {
        let samples = self.resampler.process(samples);
        let mut events = ProcessedNativeAudioEvents::default();

        self.frame_buffer.extend_from_slice(&samples);
        while self.frame_buffer.len() >= self.frame_sample_count {
            let frame_samples: Vec<f32> =
                self.frame_buffer.drain(..self.frame_sample_count).collect();
            let payload = float32_to_pcm16le(&frame_samples);
            let captured_at_ms =
                (self.emitted_samples * 1000) / u64::from(NATIVE_AUDIO_SAMPLE_RATE);

            events.frames.push(NativeAudioFrameEventDto::pcm16le(
                self.session_id.clone(),
                self.source.clone(),
                self.sequence,
                NATIVE_AUDIO_FRAME_DURATION_MS,
                captured_at_ms,
                payload,
            ));

            self.sequence += 1;
            self.emitted_samples += self.frame_sample_count as u64;
        }

        self.level_buffer.extend_from_slice(&samples);
        while self.level_buffer.len() >= self.level_sample_count {
            let level_samples: Vec<f32> =
                self.level_buffer.drain(..self.level_sample_count).collect();
            events.levels.push(build_level_event(
                self.session_id.clone(),
                self.source.clone(),
                &level_samples,
                now_epoch_ms(),
            ));
        }

        events
    }

    pub fn silence_level(&self) -> NativeAudioLevelEventDto {
        NativeAudioLevelEventDto {
            session_id: self.session_id.clone(),
            source: self.source.clone(),
            level: 0.0,
            peak: 0.0,
            is_muted_like: true,
            measured_at_ms: now_epoch_ms(),
        }
    }
}

#[derive(Default)]
pub struct ProcessedNativeAudioEvents {
    pub frames: Vec<NativeAudioFrameEventDto>,
    pub levels: Vec<NativeAudioLevelEventDto>,
}

pub fn decode_interleaved_to_mono(
    packet: &[u8],
    frame_count: u32,
    format: NativeInputAudioFormat,
    silent: bool,
) -> Result<Vec<f32>, NativeAudioProcessingError> {
    let format = format.validate()?;
    let frame_count = frame_count as usize;

    if silent {
        return Ok(vec![0.0; frame_count]);
    }

    let required_bytes = frame_count
        .checked_mul(format.block_align as usize)
        .ok_or(NativeAudioProcessingError::PacketTooShort)?;
    if packet.len() < required_bytes {
        return Err(NativeAudioProcessingError::PacketTooShort);
    }

    let bytes_per_sample = usize::from(format.bits_per_sample / 8);
    let channel_count = usize::from(format.channel_count);
    let mut mono = Vec::with_capacity(frame_count);

    for frame_index in 0..frame_count {
        let frame_offset = frame_index * usize::from(format.block_align);
        let mut sum = 0.0;

        for channel_index in 0..channel_count {
            let sample_offset = frame_offset + channel_index * bytes_per_sample;
            sum += decode_sample(packet, sample_offset, format)?;
        }

        mono.push(sum / channel_count as f32);
    }

    Ok(mono)
}

fn decode_sample(
    packet: &[u8],
    offset: usize,
    format: NativeInputAudioFormat,
) -> Result<f32, NativeAudioProcessingError> {
    match (format.sample_format, format.bits_per_sample) {
        (NativeSampleFormat::Pcm, 8) => packet
            .get(offset)
            .map(|value| ((*value as f32) - PCM_8BIT_MIDPOINT) / PCM_8BIT_MIDPOINT)
            .ok_or(NativeAudioProcessingError::PacketTooShort),
        (NativeSampleFormat::Pcm, 16) => {
            read_array::<2>(packet, offset).map(|bytes| i16::from_le_bytes(bytes) as f32 / 32768.0)
        }
        (NativeSampleFormat::Pcm, 24) => read_array::<3>(packet, offset).map(|bytes| {
            let raw =
                i32::from(bytes[0]) | (i32::from(bytes[1]) << 8) | (i32::from(bytes[2]) << 16);
            let signed = if raw & 0x0080_0000 != 0 {
                raw | !0x00ff_ffff
            } else {
                raw
            };
            signed as f32 / 8_388_608.0
        }),
        (NativeSampleFormat::Pcm, 32) => read_array::<4>(packet, offset)
            .map(|bytes| i32::from_le_bytes(bytes) as f32 / 2_147_483_648.0),
        (NativeSampleFormat::IeeeFloat, 32) => {
            read_array::<4>(packet, offset).map(|bytes| clamp_sample(f32::from_le_bytes(bytes)))
        }
        (NativeSampleFormat::IeeeFloat, 64) => read_array::<8>(packet, offset)
            .map(|bytes| clamp_sample(f64::from_le_bytes(bytes) as f32)),
        _ => Err(NativeAudioProcessingError::UnsupportedFormat),
    }
}

fn read_array<const N: usize>(
    packet: &[u8],
    offset: usize,
) -> Result<[u8; N], NativeAudioProcessingError> {
    let slice = packet
        .get(offset..offset + N)
        .ok_or(NativeAudioProcessingError::PacketTooShort)?;
    let mut bytes = [0; N];
    bytes.copy_from_slice(slice);
    Ok(bytes)
}

fn float32_to_pcm16le(samples: &[f32]) -> Vec<u8> {
    let mut payload = Vec::with_capacity(samples.len() * 2);

    for sample in samples {
        let sample = clamp_sample(*sample);
        let value = if sample < 0.0 {
            (sample * 32768.0).round() as i16
        } else {
            (sample * 32767.0).round() as i16
        };
        payload.extend_from_slice(&value.to_le_bytes());
    }

    payload
}

fn build_level_event(
    session_id: String,
    source: NativeAudioSource,
    samples: &[f32],
    measured_at_ms: u64,
) -> NativeAudioLevelEventDto {
    let mut sum_squares = 0.0;
    let mut peak = 0.0;

    for sample in samples {
        let sample = clamp_sample(*sample);
        let absolute = sample.abs();
        sum_squares += sample * sample;
        if absolute > peak {
            peak = absolute;
        }
    }

    let level = if samples.is_empty() {
        0.0
    } else {
        (sum_squares / samples.len() as f32).sqrt()
    };

    NativeAudioLevelEventDto {
        session_id,
        source,
        level,
        peak,
        is_muted_like: peak < DEFAULT_MUTED_THRESHOLD,
        measured_at_ms,
    }
}

fn samples_for_duration(duration_ms: u32) -> usize {
    ((u64::from(NATIVE_AUDIO_SAMPLE_RATE) * u64::from(duration_ms)) / 1000) as usize
}

fn clamp_sample(value: f32) -> f32 {
    if !value.is_finite() {
        return 0.0;
    }

    value.clamp(-1.0, 1.0)
}

fn now_epoch_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

struct LinearResampler {
    input_sample_rate: u32,
    output_sample_rate: u32,
    source_position: f64,
    pending_samples: Vec<f32>,
}

impl LinearResampler {
    fn new(input_sample_rate: u32, output_sample_rate: u32) -> Self {
        Self {
            input_sample_rate,
            output_sample_rate,
            source_position: 0.0,
            pending_samples: Vec::new(),
        }
    }

    fn process(&mut self, samples: &[f32]) -> Vec<f32> {
        if samples.is_empty() {
            return Vec::new();
        }

        if self.input_sample_rate == self.output_sample_rate {
            return samples.to_vec();
        }

        self.pending_samples.extend_from_slice(samples);
        let ratio = f64::from(self.input_sample_rate) / f64::from(self.output_sample_rate);
        let mut output = Vec::new();

        while self.source_position + 1.0 < self.pending_samples.len() as f64 {
            let left_index = self.source_position.floor() as usize;
            let right_index = (left_index + 1).min(self.pending_samples.len() - 1);
            let fraction = (self.source_position - left_index as f64) as f32;
            let left = self.pending_samples[left_index];
            let right = self.pending_samples[right_index];

            output.push(left + (right - left) * fraction);
            self.source_position += ratio;
        }

        let consumed_samples = self.source_position.floor() as usize;
        if consumed_samples > 0 {
            self.pending_samples.drain(..consumed_samples);
            self.source_position -= consumed_samples as f64;
        }

        output
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pcm16_format(sample_rate: u32, channels: u16) -> NativeInputAudioFormat {
        NativeInputAudioFormat {
            sample_rate,
            channel_count: channels,
            bits_per_sample: 16,
            block_align: channels * 2,
            sample_format: NativeSampleFormat::Pcm,
        }
    }

    #[test]
    fn decode_interleaved_pcm16_to_mono() {
        let packet = [
            0x00, 0x40, 0x00, 0x00, // frame 1: 0.5 left, 0 right
            0x00, 0xc0, 0x00, 0x40, // frame 2: -0.5 left, 0.5 right
        ];
        let mono = decode_interleaved_to_mono(&packet, 2, pcm16_format(48_000, 2), false)
            .expect("packet should decode");

        assert_eq!(mono.len(), 2);
        assert!((mono[0] - 0.25).abs() < 0.001);
        assert!(mono[1].abs() < 0.001);
    }

    #[test]
    fn decode_silent_packet_returns_zero_samples() {
        let mono = decode_interleaved_to_mono(&[], 4, pcm16_format(48_000, 2), true)
            .expect("silent packet");

        assert_eq!(mono, vec![0.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn processor_resamples_to_realtime_pcm_frames() {
        let mut processor = CaptureSignalProcessor::new(
            "capture-1".to_string(),
            NativeAudioSource::Microphone,
            48_000,
        );
        let input = vec![0.5; 960];
        let events = processor.push_mono_samples(&input);

        assert_eq!(events.frames.len(), 1);
        assert_eq!(events.frames[0].sample_rate, NATIVE_AUDIO_SAMPLE_RATE);
        assert_eq!(events.frames[0].duration_ms, NATIVE_AUDIO_FRAME_DURATION_MS);
        assert_eq!(events.frames[0].payload.len(), 640);
        assert_eq!(events.frames[0].captured_at_ms, 0);
    }

    #[test]
    fn processor_emits_level_events() {
        let mut processor = CaptureSignalProcessor::new(
            "capture-1".to_string(),
            NativeAudioSource::System,
            NATIVE_AUDIO_SAMPLE_RATE,
        );
        let input = vec![0.25; samples_for_duration(NATIVE_AUDIO_LEVEL_INTERVAL_MS)];
        let events = processor.push_mono_samples(&input);

        assert_eq!(events.levels.len(), 1);
        assert!((events.levels[0].level - 0.25).abs() < 0.001);
        assert!(!events.levels[0].is_muted_like);
    }
}
