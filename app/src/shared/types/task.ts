import type { components, operations } from './openapi'

type Schemas = components['schemas']
type ListTasksOperation = operations['list_transcriptions_api_transcription_tasks__get']

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

/** GET /api/transcription-tasks query parameters. */
export type TaskListApiQuery = NonNullable<ListTasksOperation['parameters']['query']>

/** GET /api/transcription-tasks status filter. */
export type TaskListFilterStatus = NonNullable<TaskListApiQuery['status']>

/** GET /api/transcription-tasks sort field. */
export type TaskSortBy = NonNullable<TaskListApiQuery['sort_by']>

/** GET /api/transcription-tasks sort order. */
export type SortOrder = NonNullable<TaskListApiQuery['order']>

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
