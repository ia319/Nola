import type {
  ActiveModelDownloadsResponse,
  DownloadProgressResponse,
  ModelCancelResponse,
  ModelDeleteResponse,
  ModelDetailResponse,
  ModelDirSource,
  ModelDownloadStartedResponse,
  ModelDownloadStatus,
  ModelListApiQuery,
  ModelListFilterStatus,
  ModelListResponse,
  ModelListSortBy,
  ModelListSortOrder,
  ModelResponse,
  ModelSelectResponse,
  ModelSettingsResponse,
  ModelSettingsUpdateRequest,
  ModelStatus,
} from '@/shared/types'

export type {
  ActiveModelDownloadsResponse,
  DownloadProgressResponse,
  ModelCancelResponse,
  ModelDeleteResponse,
  ModelDetailResponse,
  ModelDirSource,
  ModelDownloadStartedResponse,
  ModelDownloadStatus,
  ModelListApiQuery,
  ModelListFilterStatus,
  ModelListResponse,
  ModelListSortBy,
  ModelListSortOrder,
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
