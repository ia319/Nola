import type { LiveDurationMs, LiveTimestampMs, LiveUnsubscribe } from '../types'
import type { LiveSessionDetail, LiveTrack, LiveTrackSource } from '@/shared/types'

export type LiveRealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'streaming'
  | 'finishing'
  | 'closed'
  | 'failed'

export type LiveRealtimeClientEventType =
  | 'client.hello'
  | 'track.start'
  | 'track.stop'
  | 'audio.frame'
  | 'diagnostics.wav.start'
  | 'diagnostics.wav.stop'
  | 'session.finish'
  | 'client.ping'

export type LiveRealtimeServerEventType =
  | 'server.ready'
  | 'track.ready'
  | 'diagnostics.wav.started'
  | 'diagnostics.wav.stopped'
  | 'transcript.partial'
  | 'transcript.final'
  | 'session.finished'
  | 'server.error'
  | 'server.pong'

export type LiveRealtimeErrorCode =
  | 'protocol_version_unsupported'
  | 'session_not_found'
  | 'session_not_active'
  | 'session_already_streaming'
  | 'invalid_event'
  | 'invalid_event_order'
  | 'invalid_track'
  | 'track_source_unsupported'
  | 'audio_format_unsupported'
  | 'audio_frame_invalid'
  | 'audio_sequence_invalid'
  | 'audio_frame_too_large'
  | 'diagnostics_wav_already_started'
  | 'diagnostics_wav_not_started'
  | 'diagnostics_wav_output_invalid'
  | 'diagnostics_wav_limit_exceeded'
  | 'diagnostics_wav_write_failed'
  | 'connection_closed'
  | 'mock_transcriber_failed'
  | 'repository_write_failed'
  | 'internal_error'

export type LiveRealtimeTransportErrorCode =
  | LiveRealtimeErrorCode
  | 'websocket_unavailable'
  | 'websocket_connect_failed'
  | 'websocket_closed'
  | 'server_event_invalid'
  | 'transport_not_connected'
  | 'transport_state_invalid'
  | 'tauri_realtime_transport_not_implemented'

export type LiveRealtimeDiagnosticsWavStopReason =
  | 'client_stop'
  | 'session_finish'
  | 'connection_closed'
  | 'limit_exceeded'
  | 'write_failed'

export type LiveRealtimeAudioEncoding = 'pcm_s16le'
export type LiveRealtimeAudioByteOrder = 'little_endian'
export type LiveRealtimeDiagnosticsOutputTarget = 'default'

export interface LiveRealtimeEventEnvelope<TType extends string> {
  type: TType
  protocol_version: number
  session_id: string
  event_id: string
  sent_at: string
}

export interface LiveRealtimeClientCapabilities {
  supports_binary_audio: boolean
  supports_diagnostics_wav: boolean
  supports_system_audio: boolean
}

export interface LiveRealtimeClientHelloEvent extends LiveRealtimeEventEnvelope<'client.hello'> {
  client_capabilities: LiveRealtimeClientCapabilities
}

export interface LiveRealtimeTrackStartEvent extends LiveRealtimeEventEnvelope<'track.start'> {
  source: LiveTrackSource
  sequence: number
  label?: string | null
  device_label?: string | null
  sample_rate?: number | null
  channel_count?: number | null
}

export interface LiveRealtimeTrackStopEvent extends LiveRealtimeEventEnvelope<'track.stop'> {
  track_id: string
  source: LiveTrackSource
  sequence: number
}

export interface LiveRealtimeAudioFrameMetadataEvent extends LiveRealtimeEventEnvelope<'audio.frame'> {
  track_id: string
  source: LiveTrackSource
  sequence: number
  captured_at_ms: LiveTimestampMs
  duration_ms: LiveDurationMs
  byte_length: number
  encoding: LiveRealtimeAudioEncoding
  sample_rate: number
  channel_count: number
}

export interface LiveRealtimeDiagnosticsWavStartEvent extends LiveRealtimeEventEnvelope<'diagnostics.wav.start'> {
  output_target?: LiveRealtimeDiagnosticsOutputTarget | null
  max_duration_ms?: LiveDurationMs | null
  max_bytes?: number | null
  tracks?: string[] | null
}

export type LiveRealtimeDiagnosticsWavStopEvent = LiveRealtimeEventEnvelope<'diagnostics.wav.stop'>

export type LiveRealtimeSessionFinishEvent = LiveRealtimeEventEnvelope<'session.finish'>

export type LiveRealtimeClientPingEvent = LiveRealtimeEventEnvelope<'client.ping'>

type LiveRealtimeClientEnvelopeKey = 'protocol_version' | 'session_id' | 'event_id' | 'sent_at'

export type LiveRealtimeClientEvent =
  | LiveRealtimeClientHelloEvent
  | LiveRealtimeTrackStartEvent
  | LiveRealtimeTrackStopEvent
  | LiveRealtimeAudioFrameMetadataEvent
  | LiveRealtimeDiagnosticsWavStartEvent
  | LiveRealtimeDiagnosticsWavStopEvent
  | LiveRealtimeSessionFinishEvent
  | LiveRealtimeClientPingEvent

export type LiveRealtimeClientControlEventInput =
  | Omit<LiveRealtimeTrackStartEvent, LiveRealtimeClientEnvelopeKey>
  | Omit<LiveRealtimeTrackStopEvent, LiveRealtimeClientEnvelopeKey>
  | Omit<LiveRealtimeDiagnosticsWavStartEvent, LiveRealtimeClientEnvelopeKey>
  | Omit<LiveRealtimeDiagnosticsWavStopEvent, LiveRealtimeClientEnvelopeKey>
  | Omit<LiveRealtimeSessionFinishEvent, LiveRealtimeClientEnvelopeKey>
  | Omit<LiveRealtimeClientPingEvent, LiveRealtimeClientEnvelopeKey>

export interface LiveRealtimeAudioContract {
  encoding: LiveRealtimeAudioEncoding
  byte_order: LiveRealtimeAudioByteOrder
  sample_rate: 16000
  channel_count: 1
  frame_duration_ms_min: number
  frame_duration_ms_max: number
  frame_payload_bytes_max: number
}

export interface LiveRealtimeDiagnosticsWavFile {
  track_id: string
  source: LiveTrackSource
  file_name: string
  duration_ms: LiveDurationMs
  audio_byte_length: number
  file_byte_length: number
}

export interface LiveRealtimeErrorPayload {
  code: LiveRealtimeErrorCode
  message: string
}

export interface LiveRealtimeServerReadyEvent extends LiveRealtimeEventEnvelope<'server.ready'> {
  audio_contract: LiveRealtimeAudioContract
  session: LiveSessionDetail
}

export interface LiveRealtimeTrackReadyEvent extends LiveRealtimeEventEnvelope<'track.ready'> {
  track: LiveTrack
}

export interface LiveRealtimeDiagnosticsWavStartedEvent extends LiveRealtimeEventEnvelope<'diagnostics.wav.started'> {
  capture_id: string
  manifest_name: string
  max_duration_ms: LiveDurationMs
  max_bytes: number
  tracks: string[] | null
}

export interface LiveRealtimeDiagnosticsWavStoppedEvent extends LiveRealtimeEventEnvelope<'diagnostics.wav.stopped'> {
  capture_id: string
  manifest_name: string
  files: LiveRealtimeDiagnosticsWavFile[]
  total_file_byte_length: number
  reason: LiveRealtimeDiagnosticsWavStopReason
}

export interface LiveRealtimeTranscriptPartialPayload {
  track_id: string
  source: LiveTrackSource
  partial_index: number
  start_ms: LiveTimestampMs
  end_ms: LiveTimestampMs
  text: string
  language: string | null
  confidence: number | null
  is_final: false
}

export interface LiveRealtimeTranscriptFinalPayload {
  segment_id: string
  session_id: string
  track_id: string
  source: LiveTrackSource
  sequence: number
  start_ms: LiveTimestampMs
  end_ms: LiveTimestampMs
  text: string
  language: string | null
  confidence: number | null
  is_final: true
  created_at: string
}

export interface LiveRealtimeTranscriptPartialEvent extends LiveRealtimeEventEnvelope<'transcript.partial'> {
  transcript: LiveRealtimeTranscriptPartialPayload
}

export interface LiveRealtimeTranscriptFinalEvent extends LiveRealtimeEventEnvelope<'transcript.final'> {
  transcript: LiveRealtimeTranscriptFinalPayload
}

export interface LiveRealtimeSessionFinishedEvent extends LiveRealtimeEventEnvelope<'session.finished'> {
  session: LiveSessionDetail
}

export interface LiveRealtimeServerErrorEvent extends LiveRealtimeEventEnvelope<'server.error'> {
  error: LiveRealtimeErrorPayload
}

export type LiveRealtimeServerPongEvent = LiveRealtimeEventEnvelope<'server.pong'>

export type LiveRealtimeServerEvent =
  | LiveRealtimeServerReadyEvent
  | LiveRealtimeTrackReadyEvent
  | LiveRealtimeDiagnosticsWavStartedEvent
  | LiveRealtimeDiagnosticsWavStoppedEvent
  | LiveRealtimeTranscriptPartialEvent
  | LiveRealtimeTranscriptFinalEvent
  | LiveRealtimeSessionFinishedEvent
  | LiveRealtimeServerErrorEvent
  | LiveRealtimeServerPongEvent

export type LiveRealtimeAudioPayload = ArrayBuffer | ArrayBufferView

export interface LiveRealtimeAudioFrame {
  trackId: string
  source: LiveTrackSource
  sequence: number
  capturedAtMs: LiveTimestampMs
  durationMs: LiveDurationMs
  payload: LiveRealtimeAudioPayload
  encoding?: LiveRealtimeAudioEncoding
  sampleRate?: number
  channelCount?: number
}

export interface LiveRealtimeTrackStartOptions {
  source: LiveTrackSource
  label?: string | null
  deviceLabel?: string | null
  sampleRate?: number | null
  channelCount?: number | null
}

export interface LiveRealtimeTrackStopOptions {
  source?: LiveTrackSource
  sequence?: number
}

export interface LiveRealtimeDiagnosticsWavStartOptions {
  outputTarget?: LiveRealtimeDiagnosticsOutputTarget | null
  maxDurationMs?: LiveDurationMs | null
  maxBytes?: number | null
  tracks?: string[] | null
}

export interface LiveRealtimeConnectOptions {
  clientCapabilities?: Partial<LiveRealtimeClientCapabilities>
}

export interface LiveRealtimeTransportErrorShape {
  code: LiveRealtimeTransportErrorCode
  message: string
  retryable: boolean
}

export interface LiveRealtimeTransportStateChange {
  state: LiveRealtimeConnectionState
  previousState: LiveRealtimeConnectionState
  changedAt: LiveTimestampMs
  error: LiveRealtimeTransportErrorShape | null
}

export type LiveRealtimeServerEventCallback = (event: LiveRealtimeServerEvent) => void
export type LiveRealtimeTransportStateCallback = (change: LiveRealtimeTransportStateChange) => void

export interface LiveRealtimeTransport {
  readonly state: LiveRealtimeConnectionState
  connect(
    sessionId: string,
    options?: LiveRealtimeConnectOptions,
  ): Promise<LiveRealtimeServerReadyEvent>
  disconnect(code?: number, reason?: string): void
  close(code?: number, reason?: string): void
  sendControlEvent(event: LiveRealtimeClientControlEventInput): void
  startTrack(options: LiveRealtimeTrackStartOptions): void
  sendAudioFrame(frame: LiveRealtimeAudioFrame): void
  stopTrack(trackId: string, options?: LiveRealtimeTrackStopOptions): void
  startDiagnosticsWav(options?: LiveRealtimeDiagnosticsWavStartOptions): void
  stopDiagnosticsWav(): void
  ping(): void
  finish(): void
  onEvent(callback: LiveRealtimeServerEventCallback): LiveUnsubscribe
  onStateChange(callback: LiveRealtimeTransportStateCallback): LiveUnsubscribe
}
