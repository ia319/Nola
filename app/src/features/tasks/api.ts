import apiClient from '@/shared/lib/api-client'
import type {
  BatchTaskActionRequest,
  BatchTaskActionResponse,
  CancelTaskResponse,
  CreateTaskPayload,
  CreateTaskResponse,
  DeleteTaskRecordResponse,
  SortOrder,
  TaskDetail,
  TaskListResponse,
  TaskSortBy,
  TaskStatus,
} from '@/shared/types'

const BASE = '/api/transcription-tasks'

export async function createTask(payload: CreateTaskPayload): Promise<CreateTaskResponse> {
  if (!payload.file_id) {
    throw new Error('createTask requires a non-empty file_id')
  }
  // Strip undefined fields so the backend applies its own defaults for omitted options.
  const body = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined))
  const { data } = await apiClient.post<CreateTaskResponse>(BASE + '/', body)
  return data
}

export async function listTasks(
  params: {
    status?: TaskStatus
    q?: string
    sort_by?: TaskSortBy
    order?: SortOrder
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

export async function getTask(taskId: string, signal?: AbortSignal): Promise<TaskDetail> {
  const { data } = await apiClient.get<TaskDetail>(`${BASE}/${taskId}`, {
    signal,
  })
  return data
}

export async function cancelTask(taskId: string): Promise<CancelTaskResponse> {
  const { data } = await apiClient.delete<CancelTaskResponse>(`${BASE}/${taskId}`)
  return data
}

export async function batchCancelTasks(
  taskIds: BatchTaskActionRequest['task_ids'],
): Promise<BatchTaskActionResponse> {
  const { data } = await apiClient.post<BatchTaskActionResponse>(`${BASE}/batch/cancel`, {
    task_ids: taskIds,
  })
  return data
}

export async function batchRetryTasks(
  taskIds: BatchTaskActionRequest['task_ids'],
): Promise<BatchTaskActionResponse> {
  const { data } = await apiClient.post<BatchTaskActionResponse>(`${BASE}/batch/retry`, {
    task_ids: taskIds,
  })
  return data
}

export async function deleteTaskRecord(taskId: string): Promise<DeleteTaskRecordResponse> {
  const { data } = await apiClient.delete<DeleteTaskRecordResponse>(`${BASE}/${taskId}/record`)
  return data
}
