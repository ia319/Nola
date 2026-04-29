import type { components, operations } from './openapi'

// Extract schema namespace for cleaner access.
type Schemas = components['schemas']
type ListFilesOperation = operations['list_files_api_files__get']

/** File metadata returned by GET /api/files/{id}. */
export type FileInfo = Schemas['FileResponse']

/** POST /api/files/ response. */
export type FileUploadResponse = Schemas['FileUploadResponse']

/** GET /api/files/ response. */
export type FileListResponse = Schemas['FileListResponse']

/** GET /api/files/ query parameters. */
export type FileListApiQuery = NonNullable<ListFilesOperation['parameters']['query']>

/** GET /api/files/ sort field. */
export type FileSortBy = NonNullable<FileListApiQuery['sort_by']>

/** GET /api/files/ sort order. */
export type FileSortOrder = NonNullable<FileListApiQuery['order']>

/** GET /api/files/ content type filter. */
export type FileContentTypeFilter = NonNullable<FileListApiQuery['content_type']>

/** GET /api/files/check-integrity response. */
export type IntegrityCheckResponse = Schemas['IntegrityCheckResponse']

/** POST /api/files/cleanup response. */
export type CleanupResponse = Schemas['CleanupResponse']

/** DELETE /api/files/{id} response. */
export type DeleteResponse = Schemas['DeleteResponse']

/** POST /api/files/batch/delete request. */
export type BatchFileDeleteRequest = Schemas['BatchFileDeleteRequest']

/** POST /api/files/batch/delete response. */
export type BatchFileDeleteResponse = Schemas['BatchFileDeleteResponse']

/** Per-file batch delete result. */
export type BatchFileDeleteResult = Schemas['BatchFileDeleteResultResponse']

/** Batch file delete summary. */
export type BatchFileDeleteSummary = Schemas['BatchFileDeleteSummaryResponse']
