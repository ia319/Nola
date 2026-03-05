import apiClient from '@/shared/lib/api-client'
import type {
  CancelTaskResponse,
  CreateTaskPayload,
  CreateTaskResponse,
  DefaultOptions,
  TaskDetail,
  TaskListResponse,
  TaskStatus,
} from '@/shared/types'

const BASE = '/api/transcriptions'

/** Create a transcription task for an uploaded file. */
export async function createTask(payload: CreateTaskPayload): Promise<CreateTaskResponse> {
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

/** Fetch default transcription options from backend. */
export async function getDefaultOptions(): Promise<DefaultOptions> {
  const { data } = await apiClient.get<DefaultOptions>(BASE + '/options/defaults')
  return data
}
