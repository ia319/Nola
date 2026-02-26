import type { components } from './openapi'

type Schemas = components['schemas']

// Thin aliases over generated OpenAPI schemas.

export type TaskSummary = Schemas['TaskSummaryResponse']
export type TaskDetail = Schemas['TaskDetailResponse']
export type TaskListResponse = Schemas['TaskListResponse']
export type CreateTaskResponse = Schemas['CreateTaskResponse']
export type CancelTaskResponse = Schemas['CancelTaskResponse']
export type Segment = Schemas['SegmentResponse']

/** Task status derived from OpenAPI enum constraint. */
export type TaskStatus = Schemas['TaskSummaryResponse']['status']

/** GET /{task_id}/export?save=true response. */
export type SavedExportResponse = Schemas['SavedExportResponse']

/** POST /api/transcriptions/ request body. */
export type CreateTaskRequest = Schemas['TranscriptionRequest']

/** POST /api/transcriptions/export/batch request. */
export type BatchExportRequest = Schemas['BatchExportRequest']

// Derived convenience types for frontend use.

/** Export format derived from OpenAPI BatchExportRequest.format enum. */
export type ExportFormat = Schemas['BatchExportRequest']['format']

/** GET /api/transcriptions/options/defaults response (dynamic). */
export type DefaultOptions = Record<string, unknown>
