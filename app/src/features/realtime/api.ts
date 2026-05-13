import apiClient from '@/shared/lib/api-client'
import { parseFilenameFromContentDisposition } from '@/shared/lib/content-disposition'
import type {
  BatchLiveSessionActionRequest,
  BatchLiveSessionActionResponse,
  DeleteLiveSessionRecordResponse,
  ExportFormat,
  LiveSessionBatchExportRequest,
  LiveSessionDetail,
  LiveSessionListApiQuery,
  LiveSessionListResponse,
  SavedExportResponse,
  CreateLiveSessionRequest,
} from '@/shared/types'

const BASE = '/api/live/sessions'

export interface LiveSessionExportDownloadResult {
  blob: Blob
  filename: string | null
}

export interface LiveSessionDetailQuery {
  segmentLimit?: number
  segmentOffset?: number
}

export interface LiveSessionExportApiOptions {
  filename?: string
  format?: ExportFormat
  include_timestamps?: boolean
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
  if (payload.runtime_overrides !== undefined) {
    body.runtime_overrides = payload.runtime_overrides
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

function buildLiveListParams(query: LiveSessionListApiQuery = {}): LiveSessionListApiQuery {
  const params: LiveSessionListApiQuery = {}

  if (query.limit !== undefined) {
    params.limit = query.limit
  }
  if (query.offset !== undefined) {
    params.offset = query.offset
  }
  if (query.q !== undefined) {
    params.q = query.q
  }
  if (query.status !== undefined) {
    params.status = query.status
  }
  if (query.sort_by !== undefined) {
    params.sort_by = query.sort_by
  }
  if (query.order !== undefined) {
    params.order = query.order
  }

  return params
}

export async function listLiveSessions(
  query: LiveSessionListApiQuery = {},
  signal?: AbortSignal,
): Promise<LiveSessionListResponse> {
  const { data } = await apiClient.get<LiveSessionListResponse>(BASE, {
    params: buildLiveListParams(query),
    signal,
  })
  return data
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

export async function downloadLiveSessionExport(
  sessionId: string,
  params: LiveSessionExportApiOptions = {},
  signal?: AbortSignal,
): Promise<LiveSessionExportDownloadResult> {
  const response = await apiClient.get<Blob>(`${BASE}/${sessionId}/export`, {
    params: { ...params, save: false },
    responseType: 'blob',
    signal,
  })
  return {
    blob: response.data,
    filename: parseFilenameFromContentDisposition(response.headers['content-disposition']),
  }
}

export async function saveLiveSessionExport(
  sessionId: string,
  params: LiveSessionExportApiOptions = {},
  signal?: AbortSignal,
): Promise<SavedExportResponse> {
  const { data } = await apiClient.get<SavedExportResponse>(`${BASE}/${sessionId}/export`, {
    params: { ...params, save: true },
    signal,
  })
  return data
}

export async function batchExportLiveSessions(
  request: LiveSessionBatchExportRequest,
  signal?: AbortSignal,
): Promise<LiveSessionExportDownloadResult> {
  const response = await apiClient.post<Blob>(`${BASE}/export/batch`, request, {
    responseType: 'blob',
    signal,
  })
  return {
    blob: response.data,
    filename: parseFilenameFromContentDisposition(response.headers['content-disposition']),
  }
}

export async function deleteLiveSessionRecord(
  sessionId: string,
): Promise<DeleteLiveSessionRecordResponse> {
  const { data } = await apiClient.delete<DeleteLiveSessionRecordResponse>(
    `${BASE}/${sessionId}/record`,
  )
  return data
}

export async function batchDeleteLiveSessionRecords(
  request: BatchLiveSessionActionRequest,
): Promise<BatchLiveSessionActionResponse> {
  const { data } = await apiClient.post<BatchLiveSessionActionResponse>(
    `${BASE}/batch/delete-records`,
    request,
  )
  return data
}
