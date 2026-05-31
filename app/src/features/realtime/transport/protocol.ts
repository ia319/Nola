import { getRealtimeWebSocketBaseUrl } from '@/config/backend'

import type {
  LiveRealtimeAudioEncoding,
  LiveRealtimeClientCapabilities,
  LiveRealtimeDiagnosticsWavStopReason,
  LiveRealtimeErrorCode,
  LiveRealtimeServerEvent,
  LiveRealtimeServerEventType,
} from './types'

export const LIVE_REALTIME_PROTOCOL_VERSION = 1

export const LIVE_REALTIME_AUDIO_ENCODING: LiveRealtimeAudioEncoding = 'pcm_s16le'
export const LIVE_REALTIME_AUDIO_SAMPLE_RATE = 16000
export const LIVE_REALTIME_AUDIO_CHANNEL_COUNT = 1

export const LIVE_REALTIME_DEFAULT_CLIENT_CAPABILITIES: LiveRealtimeClientCapabilities = {
  supports_binary_audio: true,
  supports_diagnostics_wav: false,
  supports_system_audio: false,
}

export const LIVE_REALTIME_SERVER_EVENT_TYPES = [
  'server.ready',
  'track.ready',
  'diagnostics.wav.started',
  'diagnostics.wav.stopped',
  'transcript.preview',
  'transcript.committed_partial',
  'transcript.final',
  'session.finished',
  'server.error',
  'server.pong',
] as const satisfies readonly LiveRealtimeServerEventType[]

const LIVE_REALTIME_SERVER_EVENT_TYPE_SET = new Set<string>(LIVE_REALTIME_SERVER_EVENT_TYPES)
const LIVE_REALTIME_TRACK_SOURCE_SET = new Set<string>(['microphone', 'system'])
const LIVE_REALTIME_DIAGNOSTICS_STOP_REASON_SET = new Set<string>([
  'client_stop',
  'session_finish',
  'connection_closed',
  'limit_exceeded',
  'write_failed',
] satisfies readonly LiveRealtimeDiagnosticsWavStopReason[])
const LIVE_REALTIME_ERROR_CODE_SET = new Set<string>([
  'protocol_version_unsupported',
  'session_not_found',
  'session_not_active',
  'session_already_streaming',
  'invalid_event',
  'invalid_event_order',
  'invalid_track',
  'track_source_unsupported',
  'audio_format_unsupported',
  'audio_frame_invalid',
  'audio_sequence_invalid',
  'audio_frame_too_large',
  'diagnostics_wav_already_started',
  'diagnostics_wav_not_started',
  'diagnostics_wav_output_invalid',
  'diagnostics_wav_limit_exceeded',
  'diagnostics_wav_write_failed',
  'connection_closed',
  'mock_transcriber_failed',
  'runtime_config_invalid',
  'runtime_model_not_configured',
  'runtime_model_not_registered',
  'runtime_model_not_downloaded',
  'runtime_model_load_failed',
  'runtime_inference_failed',
  'repository_write_failed',
  'internal_error',
] satisfies readonly LiveRealtimeErrorCode[])

type JsonRecord = Record<string, unknown>

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string'
}

function isStringArrayOrNull(value: unknown): value is string[] | null {
  return value === null || (Array.isArray(value) && value.every(isString))
}

export function isLiveRealtimeServerEventType(
  value: unknown,
): value is LiveRealtimeServerEventType {
  return typeof value === 'string' && LIVE_REALTIME_SERVER_EVENT_TYPE_SET.has(value)
}

export function isLiveRealtimeServerEvent(value: unknown): value is LiveRealtimeServerEvent {
  if (!isJsonRecord(value) || !isLiveRealtimeServerEventType(value.type)) {
    return false
  }

  if (!hasLiveRealtimeEnvelope(value)) {
    return false
  }

  switch (value.type) {
    case 'server.ready':
      return isAudioContract(value.audio_contract) && isLiveSession(value.session)
    case 'track.ready':
      return isLiveTrack(value.track)
    case 'diagnostics.wav.started':
      return (
        isString(value.capture_id) &&
        isString(value.manifest_name) &&
        isNumber(value.max_duration_ms) &&
        isNumber(value.max_bytes) &&
        isStringArrayOrNull(value.tracks)
      )
    case 'diagnostics.wav.stopped':
      return (
        isString(value.capture_id) &&
        isString(value.manifest_name) &&
        Array.isArray(value.files) &&
        value.files.every(isDiagnosticsWavFile) &&
        isNumber(value.total_file_byte_length) &&
        isDiagnosticsStopReason(value.reason)
      )
    case 'transcript.preview':
      return isTranscriptPreview(value.transcript)
    case 'transcript.committed_partial':
      return isTranscriptCommittedPartial(value.transcript)
    case 'transcript.final':
      return isTranscriptFinal(value.transcript)
    case 'session.finished':
      return isLiveSession(value.session)
    case 'server.error':
      return isServerErrorPayload(value.error)
    case 'server.pong':
      return true
  }
}

export function parseLiveRealtimeServerEvent(data: string): LiveRealtimeServerEvent | null {
  try {
    const parsed: unknown = JSON.parse(data)
    return isLiveRealtimeServerEvent(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function buildLiveRealtimeWebSocketUrl(sessionId: string, baseUrl?: string): string {
  const path = `/api/live/sessions/${encodeURIComponent(sessionId)}/stream`
  const configuredBaseUrl = baseUrl ?? getRealtimeWebSocketBaseUrl()

  if (!configuredBaseUrl) {
    const location = getBrowserLocation()
    if (!location) {
      return path
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${location.host}${path}`
  }

  const resolvedUrl = resolveUrl(configuredBaseUrl, path)
  if (resolvedUrl.protocol === 'http:') {
    resolvedUrl.protocol = 'ws:'
  } else if (resolvedUrl.protocol === 'https:') {
    resolvedUrl.protocol = 'wss:'
  }

  return resolvedUrl.toString()
}

function resolveUrl(baseUrl: string, path: string): URL {
  const location = getBrowserLocation()

  if (location && baseUrl.startsWith('/')) {
    return new URL(path, `${location.origin}${baseUrl}`)
  }

  return new URL(path, ensureUrlBase(baseUrl))
}

function ensureUrlBase(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function getBrowserLocation(): Location | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.location
}

function hasLiveRealtimeEnvelope(value: JsonRecord): boolean {
  return (
    value.protocol_version === LIVE_REALTIME_PROTOCOL_VERSION &&
    isString(value.session_id) &&
    isString(value.event_id) &&
    isString(value.sent_at)
  )
}

function isLiveTrackSource(value: unknown): value is 'microphone' | 'system' {
  return isString(value) && LIVE_REALTIME_TRACK_SOURCE_SET.has(value)
}

function isDiagnosticsStopReason(value: unknown): value is LiveRealtimeDiagnosticsWavStopReason {
  return isString(value) && LIVE_REALTIME_DIAGNOSTICS_STOP_REASON_SET.has(value)
}

function isRealtimeErrorCode(value: unknown): value is LiveRealtimeErrorCode {
  return isString(value) && LIVE_REALTIME_ERROR_CODE_SET.has(value)
}

function isAudioContract(value: unknown): boolean {
  if (!isJsonRecord(value)) {
    return false
  }

  return (
    value.encoding === LIVE_REALTIME_AUDIO_ENCODING &&
    value.byte_order === 'little_endian' &&
    value.sample_rate === LIVE_REALTIME_AUDIO_SAMPLE_RATE &&
    value.channel_count === LIVE_REALTIME_AUDIO_CHANNEL_COUNT &&
    isNumber(value.frame_duration_ms_min) &&
    isNumber(value.frame_duration_ms_max) &&
    isNumber(value.frame_payload_bytes_max)
  )
}

function isLiveSession(value: unknown): boolean {
  if (!isJsonRecord(value)) {
    return false
  }

  return isString(value.session_id) && isString(value.status) && isString(value.mode)
}

function isLiveTrack(value: unknown): boolean {
  if (!isJsonRecord(value)) {
    return false
  }

  return (
    isString(value.track_id) &&
    isString(value.session_id) &&
    isLiveTrackSource(value.source) &&
    isNullableString(value.ended_at)
  )
}

function isDiagnosticsWavFile(value: unknown): boolean {
  if (!isJsonRecord(value)) {
    return false
  }

  return (
    isString(value.track_id) &&
    isLiveTrackSource(value.source) &&
    isString(value.file_name) &&
    isNumber(value.duration_ms) &&
    isNumber(value.audio_byte_length) &&
    isNumber(value.file_byte_length)
  )
}

function hasTranscriptTimingAndText(value: JsonRecord): boolean {
  return (
    isString(value.track_id) &&
    isLiveTrackSource(value.source) &&
    isNumber(value.start_ms) &&
    isNumber(value.end_ms) &&
    isString(value.text) &&
    isNullableString(value.language) &&
    (value.confidence === null || isNumber(value.confidence))
  )
}

function isTranscriptPreview(value: unknown): boolean {
  if (!isJsonRecord(value)) {
    return false
  }

  return (
    value.result_kind === 'preview' &&
    isString(value.session_id) &&
    isNumber(value.preview_index) &&
    hasTranscriptTimingAndText(value) &&
    value.is_final === false
  )
}

function isTranscriptCommittedPartial(value: unknown): boolean {
  if (!isJsonRecord(value)) {
    return false
  }

  return (
    value.result_kind === 'committed_partial' &&
    isString(value.session_id) &&
    isNumber(value.committed_index) &&
    hasTranscriptTimingAndText(value) &&
    value.is_final === false
  )
}

function isTranscriptFinal(value: unknown): boolean {
  if (!isJsonRecord(value)) {
    return false
  }

  return (
    value.result_kind === 'final' &&
    isString(value.segment_id) &&
    isString(value.session_id) &&
    isString(value.track_id) &&
    isLiveTrackSource(value.source) &&
    isNumber(value.sequence) &&
    isNumber(value.start_ms) &&
    isNumber(value.end_ms) &&
    isString(value.text) &&
    isNullableString(value.language) &&
    (value.confidence === null || isNumber(value.confidence)) &&
    value.is_final === true &&
    isString(value.created_at)
  )
}

function isServerErrorPayload(value: unknown): boolean {
  if (!isJsonRecord(value)) {
    return false
  }

  return isRealtimeErrorCode(value.code) && isString(value.message)
}
