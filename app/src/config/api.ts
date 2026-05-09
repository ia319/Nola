import apiClient from '@/shared/lib/api-client'
import type {
  AppConfig,
  EngineDefaults,
  LiveRealtimeDefaultsPatchResponse,
  LiveRealtimeDefaultsResponse,
  LiveRealtimeDefaultsUpdateRequest,
  LiveRealtimeSchemaResponse,
  SessionDefaults,
  SessionDefaultsUpdateRequest,
  TranscriptionDefaultsPatchResponse,
  TranscriptionDefaultsUpdateRequest,
} from '@/shared/types'

/** Fetch the aggregated application configuration from `GET /api/config`. */
export async function fetchAppConfig(signal?: AbortSignal): Promise<AppConfig> {
  const { data } = await apiClient.get<AppConfig>('/api/config', { signal })
  return data
}

/** Fetch raw engine defaults from `GET /api/config/transcription/engine-defaults`. */
export async function fetchEngineDefaults(signal?: AbortSignal): Promise<EngineDefaults> {
  const { data } = await apiClient.get<EngineDefaults>(
    '/api/config/transcription/engine-defaults',
    {
      signal,
    },
  )
  return data
}

/** Fetch resolved Live realtime defaults from `GET /api/config/live-realtime/defaults`. */
export async function fetchLiveRealtimeDefaults(
  signal?: AbortSignal,
): Promise<LiveRealtimeDefaultsResponse> {
  const { data } = await apiClient.get<LiveRealtimeDefaultsResponse>(
    '/api/config/live-realtime/defaults',
    { signal },
  )
  return data
}

/** Fetch Live realtime field metadata from `GET /api/config/live-realtime/schema`. */
export async function fetchLiveRealtimeSchema(
  signal?: AbortSignal,
): Promise<LiveRealtimeSchemaResponse> {
  const { data } = await apiClient.get<LiveRealtimeSchemaResponse>(
    '/api/config/live-realtime/schema',
    { signal },
  )
  return data
}

/**
 * Persist transcription-default overrides via `PATCH /api/config/transcription/defaults`.
 * Keep write requests non-cancelable until the UI adds an explicit cancel/retry flow.
 */
export async function patchTranscriptionDefaults(
  payload: TranscriptionDefaultsUpdateRequest,
): Promise<TranscriptionDefaultsPatchResponse> {
  const { data } = await apiClient.patch<TranscriptionDefaultsPatchResponse>(
    '/api/config/transcription/defaults',
    payload,
  )
  return data
}

/** Fetch Workbench session defaults from `GET /api/config/session-defaults`. */
export async function fetchSessionDefaults(signal?: AbortSignal): Promise<SessionDefaults> {
  const { data } = await apiClient.get<SessionDefaults>('/api/config/session-defaults', { signal })
  return data
}

/**
 * Persist Workbench session defaults via `PATCH /api/config/session-defaults`.
 * Keep write requests non-cancelable until the UI adds an explicit cancel/retry flow.
 */
export async function patchSessionDefaults(
  payload: SessionDefaultsUpdateRequest,
): Promise<SessionDefaults> {
  const { data } = await apiClient.patch<SessionDefaults>('/api/config/session-defaults', payload)
  return data
}

/**
 * Persist Live realtime default overrides via `PATCH /api/config/live-realtime/defaults`.
 * Keep write requests non-cancelable until the UI adds an explicit cancel/retry flow.
 */
export async function patchLiveRealtimeDefaults(
  payload: LiveRealtimeDefaultsUpdateRequest,
): Promise<LiveRealtimeDefaultsPatchResponse> {
  const { data } = await apiClient.patch<LiveRealtimeDefaultsPatchResponse>(
    '/api/config/live-realtime/defaults',
    payload,
  )
  return data
}

/**
 * Remove all persisted transcription-default overrides via `DELETE /api/config/transcription/defaults`.
 * Keep write requests non-cancelable until the UI adds an explicit cancel/retry flow.
 */
export async function deleteTranscriptionDefaults(): Promise<void> {
  await apiClient.delete('/api/config/transcription/defaults')
}

/**
 * Remove all persisted Live realtime overrides via `DELETE /api/config/live-realtime/defaults`.
 * Keep write requests non-cancelable until the UI adds an explicit cancel/retry flow.
 */
export async function deleteLiveRealtimeDefaults(): Promise<void> {
  await apiClient.delete('/api/config/live-realtime/defaults')
}
