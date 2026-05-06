import apiClient from '@/shared/lib/api-client'
import type { CreateLiveSessionRequest, LiveSessionDetail } from '@/shared/types'

const BASE = '/api/live/sessions'

export interface LiveSessionDetailQuery {
  segmentLimit?: number
  segmentOffset?: number
}

function buildCreateLiveSessionBody(payload: CreateLiveSessionRequest): CreateLiveSessionRequest {
  const body: CreateLiveSessionRequest = {
    mode: payload.mode,
  }

  if (payload.title !== undefined) {
    body.title = payload.title
  }
  if (payload.language_hint !== undefined) {
    body.language_hint = payload.language_hint
  }
  if (payload.model_id !== undefined) {
    body.model_id = payload.model_id
  }

  return body
}

function buildLiveSessionDetailParams(
  query: LiveSessionDetailQuery,
): { segment_limit?: number; segment_offset?: number } | undefined {
  const params: { segment_limit?: number; segment_offset?: number } = {}

  if (query.segmentLimit !== undefined) {
    params.segment_limit = query.segmentLimit
  }
  if (query.segmentOffset !== undefined) {
    params.segment_offset = query.segmentOffset
  }

  return Object.keys(params).length > 0 ? params : undefined
}

export async function createLiveSession(
  payload: CreateLiveSessionRequest,
  signal?: AbortSignal,
): Promise<LiveSessionDetail> {
  const { data } = await apiClient.post<LiveSessionDetail>(
    BASE,
    buildCreateLiveSessionBody(payload),
    { signal },
  )
  return data
}

export async function getLiveSession(
  sessionId: string,
  query: LiveSessionDetailQuery = {},
  signal?: AbortSignal,
): Promise<LiveSessionDetail> {
  const { data } = await apiClient.get<LiveSessionDetail>(`${BASE}/${sessionId}`, {
    params: buildLiveSessionDetailParams(query),
    signal,
  })
  return data
}

export async function finishLiveSession(
  sessionId: string,
  query: LiveSessionDetailQuery = {},
  signal?: AbortSignal,
): Promise<LiveSessionDetail> {
  const { data } = await apiClient.post<LiveSessionDetail>(
    `${BASE}/${sessionId}/finish`,
    undefined,
    {
      params: buildLiveSessionDetailParams(query),
      signal,
    },
  )
  return data
}
