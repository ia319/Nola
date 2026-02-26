import type { components } from './openapi'

type Schemas = components['schemas']

// -- Aliases extracted from openapi.d.ts --

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

// -- Frontend-only types (no backend schema) --

/** Export format literal. */
export type ExportFormat = 'srt' | 'vtt' | 'txt' | 'ass'

/** GET /api/transcriptions/options/defaults response (dynamic). */
export type DefaultOptions = Record<string, unknown>
