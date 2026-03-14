import apiClient from '@/shared/lib/api-client'
import type { AppConfig, EngineDefaults, TranscriptionDefaultsPatchResponse } from '@/shared/types'
import type { TranscriptionDefaultsUpdateRequest } from '@/shared/types/config'

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

/**
 * Remove all persisted transcription-default overrides via `DELETE /api/config/transcription/defaults`.
 * Keep write requests non-cancelable until the UI adds an explicit cancel/retry flow.
 */
export async function deleteTranscriptionDefaults(): Promise<void> {
  await apiClient.delete('/api/config/transcription/defaults')
}
