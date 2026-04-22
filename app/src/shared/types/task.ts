import type { components } from './openapi'

type Schemas = components['schemas']

// Thin aliases over generated OpenAPI schemas.

export type TaskSummary = Schemas['TaskSummaryResponse']
export type TaskDetail = Schemas['TaskDetailResponse']
export type TaskListResponse = Schemas['TaskListResponse']
export type CreateTaskResponse = Schemas['CreateTaskResponse']
export type CancelTaskResponse = Schemas['CancelTaskResponse']
export type DeleteTaskRecordResponse = Schemas['DeleteTaskRecordResponse']
export type BatchTaskActionRequest = Schemas['BatchTaskActionRequest']
export type BatchTaskActionResponse = Schemas['BatchTaskActionResponse']
export type BatchTaskActionResult = Schemas['BatchTaskActionResultResponse']
export type Segment = Schemas['SegmentResponse']

/** Task status derived from OpenAPI enum constraint. */
export type TaskStatus = Schemas['TaskSummaryResponse']['status']
// NOTE: Keep local aliases here. Avoid coupling shared query types to generated operation paths.
export type TaskSortBy = 'created_at' | 'completed_at' | 'status' | 'progress' | 'filename'
export type SortOrder = 'asc' | 'desc'

/** GET /{task_id}/export?save=true response. */
export type SavedExportResponse = Schemas['SavedExportResponse']

/** POST /api/transcription-tasks/ request body. */
export type CreateTaskRequest = Schemas['TranscriptionRequest']

/** Frontend payload for task creation — only file_id required, options use backend defaults. */
export type CreateTaskPayload = Pick<CreateTaskRequest, 'file_id'> &
  Partial<Omit<CreateTaskRequest, 'file_id'>>

/** POST /api/transcription-tasks/export/batch request. */
export type BatchExportRequest = Schemas['BatchExportRequest']

// Derived convenience types for frontend use.

/** Export format enum defined by backend formatter registry contract. */
export type ExportFormat = Schemas['ExportFormat']
