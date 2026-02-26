import type { components } from './openapi'

// Extract schema namespace for cleaner access.
type Schemas = components['schemas']

/** File metadata returned by GET /api/files/{id}. */
export type FileInfo = Schemas['FileResponse']

/** POST /api/files/ response. */
export type FileUploadResponse = Schemas['FileUploadResponse']

/** GET /api/files/ response. */
export type FileListResponse = Schemas['FileListResponse']

/** GET /api/files/check-integrity response. */
export type IntegrityCheckResponse = Schemas['IntegrityCheckResponse']

/** POST /api/files/cleanup response. */
export type CleanupResponse = Schemas['CleanupResponse']

/** DELETE /api/files/{id} response. */
export type DeleteResponse = Schemas['DeleteResponse']
