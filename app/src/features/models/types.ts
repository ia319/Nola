import type {
  DownloadProgressResponse,
  ModelCancelResponse,
  ModelDeleteResponse,
  ModelDetailResponse,
  ModelDirSource,
  ModelDownloadStartedResponse,
  ModelDownloadStatus,
  ModelListResponse,
  ModelResponse,
  ModelSelectResponse,
  ModelSettingsResponse,
  ModelSettingsUpdateRequest,
  ModelStatus,
} from '@/shared/types'

export type {
  DownloadProgressResponse,
  ModelCancelResponse,
  ModelDeleteResponse,
  ModelDetailResponse,
  ModelDirSource,
  ModelDownloadStartedResponse,
  ModelDownloadStatus,
  ModelListResponse,
  ModelResponse,
  ModelSelectResponse,
  ModelSettingsResponse,
  ModelSettingsUpdateRequest,
  ModelStatus,
}

/** SSE progress payload pushed by `/api/models/events`. */
export interface ModelDownloadSSEPayload {
  model_id: string
  status: ModelDownloadStatus
  percent: number
  downloaded_bytes: number
  total_bytes: number
  speed_bps: number
  error?: string | null
}
