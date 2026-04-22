import type { components } from './openapi'

type Schemas = components['schemas']

/** GET /api/models response item. */
export type ModelResponse = Schemas['ModelResponse']

/** GET /api/models/{model_id} response. */
export type ModelDetailResponse = Schemas['ModelDetailResponse']

/** GET /api/models response. */
export type ModelListResponse = Schemas['ModelListResponse']

/** POST /api/models/{model_id}/select response. */
export type ModelSelectResponse = Schemas['ModelSelectResponse']

/** DELETE /api/models/{model_id} response. */
export type ModelDeleteResponse = Schemas['ModelDeleteResponse']

/** POST /api/models/{model_id}/download response. */
export type ModelDownloadStartedResponse = Schemas['ModelDownloadStartedResponse']

/** POST /api/models/{model_id}/cancel response. */
export type ModelCancelResponse = Schemas['ModelCancelResponse']

/** GET /api/models/settings response. */
export type ModelSettingsResponse = Schemas['ModelSettingsResponse']

/** PATCH /api/models/settings request body. */
export type ModelSettingsUpdateRequest = Schemas['ModelSettingsUpdateRequest']

/** GET /api/models/downloads response. */
export type ActiveModelDownloadsResponse = Schemas['ActiveModelDownloadsResponse']

/** Active download item exposed by GET /api/models/downloads. */
export type ActiveModelDownload = Schemas['ActiveModelDownloadResponse']

/** In-flight download progress nested under model list/detail responses. */
export type DownloadProgressResponse = Schemas['DownloadProgressResponse']

/** Model availability state derived from backend schema. */
export type ModelStatus = ModelResponse['status']

/** Active download lifecycle derived from backend schema. */
export type ModelDownloadStatus = ActiveModelDownload['status']

/** Model directory override source derived from backend schema. */
export type ModelDirSource = ModelSettingsResponse['override_source']
