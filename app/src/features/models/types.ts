import type { components } from '@/shared/types/openapi'

export type ModelResponse = components['schemas']['ModelResponse']
export type ModelDetailResponse = components['schemas']['ModelDetailResponse']
export type ModelListResponse = components['schemas']['ModelListResponse']
export type ModelSelectResponse = components['schemas']['ModelSelectResponse']
export type ModelDeleteResponse = components['schemas']['ModelDeleteResponse']
export type ModelDownloadStartedResponse = components['schemas']['ModelDownloadStartedResponse']
export type ModelCancelResponse = components['schemas']['ModelCancelResponse']
export type ModelSettingsResponse = components['schemas']['ModelSettingsResponse']
export type ModelSettingsUpdateRequest = components['schemas']['ModelSettingsUpdateRequest']
export type DownloadProgressResponse = components['schemas']['DownloadProgressResponse']

export type ModelStatus = ModelResponse['status']
export type ModelDirSource = ModelSettingsResponse['override_source']

/** SSE progress payload pushed by `/api/models/events`. */
export interface ModelDownloadSSEPayload {
  model_id: string
  status: 'downloading' | 'completed' | 'failed' | 'cancelled'
  percent: number
  downloaded_bytes: number
  total_bytes: number
  speed_bps: number
  error?: string | null
}
