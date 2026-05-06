import type { components } from './openapi'

type Schemas = components['schemas']

// Thin aliases over generated Live OpenAPI schemas.

export type CreateLiveSessionRequest = Schemas['CreateLiveSessionRequest']
export type LiveSegment = Schemas['LiveSegmentResponse']
export type LiveSessionDetail = Schemas['LiveSessionDetailResponse']
export type LiveSessionListResponse = Schemas['LiveSessionListResponse']
export type LiveSessionSummary = Schemas['LiveSessionSummaryResponse']
export type LiveTrack = Schemas['LiveTrackResponse']

/** Live session mode derived from backend schema. */
export type LiveSessionMode = LiveSessionSummary['mode']

/** Live session status derived from backend schema. */
export type LiveSessionStatus = LiveSessionSummary['status']

/** Live track source derived from backend schema. */
export type LiveTrackSource = LiveTrack['source']
