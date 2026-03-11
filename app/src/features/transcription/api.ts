import apiClient from '@/shared/lib/api-client'
import type {
  AppConfig,
  CancelTaskResponse,
  CreateTaskPayload,
  CreateTaskResponse,
  TaskDetail,
  TaskListResponse,
  TaskStatus,
  TranscriptionDefaults,
} from '@/shared/types'

const BASE = '/api/transcriptions'

/** Create a transcription task for an uploaded file. */
export async function createTask(payload: CreateTaskPayload): Promise<CreateTaskResponse> {
  if (!payload.file_id) {
    throw new Error('createTask requires a non-empty file_id')
  }
  // Strip undefined fields so the backend applies its own defaults for omitted options.
  const body = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined))
  const { data } = await apiClient.post<CreateTaskResponse>(BASE + '/', body)
  return data
}

/** List tasks with optional status filter and pagination. */
export async function listTasks(
  params: {
    status?: TaskStatus
    limit?: number
    offset?: number
  } = {},
  signal?: AbortSignal,
): Promise<TaskListResponse> {
  const { data } = await apiClient.get<TaskListResponse>(BASE + '/', {
    params,
    signal,
  })
  return data
}

/** Get full task detail including segments. */
export async function getTask(taskId: string, signal?: AbortSignal): Promise<TaskDetail> {
  const { data } = await apiClient.get<TaskDetail>(`${BASE}/${taskId}`, {
    signal,
  })
  return data
}

/** Cancel a pending or processing task. */
export async function cancelTask(taskId: string): Promise<CancelTaskResponse> {
  const { data } = await apiClient.delete<CancelTaskResponse>(`${BASE}/${taskId}`)
  return data
}

/** Fetch effective transcription defaults from the aggregated config API. */
export async function getTranscriptionDefaults(
  signal?: AbortSignal,
): Promise<TranscriptionDefaults> {
  const { data } = await apiClient.get<AppConfig>('/api/config', { signal })
  return data.transcription.defaults
}
