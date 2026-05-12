import type { components, operations } from './openapi'

type Schemas = components['schemas']
type ListLiveSessionsOperation = operations['list_live_sessions_endpoint_api_live_sessions_get']
type ExportLiveSessionOperation =
  operations['export_live_session_endpoint_api_live_sessions__session_id__export_get']

// Thin aliases over generated Live OpenAPI schemas.

export type CreateLiveSessionRequest = Schemas['CreateLiveSessionRequest']
export type BatchLiveSessionActionRequest = Schemas['BatchLiveSessionActionRequest']
export type BatchLiveSessionActionResponse = Schemas['BatchLiveSessionActionResponse']
export type BatchLiveSessionActionResult = Schemas['BatchLiveSessionActionResultResponse']
export type DeleteLiveSessionRecordResponse = Schemas['DeleteLiveSessionRecordResponse']
export type LiveSegment = Schemas['LiveSegmentResponse']
export type LiveSessionBatchExportRequest = Schemas['LiveSessionBatchExportRequest']
export type LiveSessionDetail = Schemas['LiveSessionDetailResponse']
export type LiveSessionListResponse = Schemas['LiveSessionListResponse']
export type LiveSessionSummary = Schemas['LiveSessionSummaryResponse']
export type LiveTrack = Schemas['LiveTrackResponse']

/** GET /api/live/sessions query parameters. */
export type LiveSessionListApiQuery = NonNullable<ListLiveSessionsOperation['parameters']['query']>

/** GET /api/live/sessions status filter. */
export type LiveSessionListFilterStatus = NonNullable<LiveSessionListApiQuery['status']>

/** GET /api/live/sessions sort field. */
export type LiveSessionSortBy = NonNullable<LiveSessionListApiQuery['sort_by']>

/** GET /api/live/sessions sort order. */
export type LiveSessionSortOrder = NonNullable<LiveSessionListApiQuery['order']>

/** GET /api/live/sessions/{session_id}/export query parameters. */
export type LiveSessionExportApiQuery = NonNullable<
  ExportLiveSessionOperation['parameters']['query']
>

/** Live session mode derived from backend schema. */
export type LiveSessionMode = LiveSessionSummary['mode']

/** Live session status derived from backend schema. */
export type LiveSessionStatus = LiveSessionSummary['status']

/** Live request overrides captured at session creation time. */
export type LiveSessionRequestOverrides = LiveSessionDetail['request_overrides']

/** Live track source derived from backend schema. */
export type LiveTrackSource = LiveTrack['source']
