import apiClient from '@/shared/lib/api-client'
import type {
  BatchTaskActionRequest,
  BatchTaskActionResponse,
  SortOrder,
  TaskListResponse,
  TaskSortBy,
  TaskStatus,
} from '@/shared/types'

const BASE = '/api/transcription-tasks'

/** List history tasks through backend pagination/filter APIs. */
export async function listHistoryTasks(
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

/** Cancel multiple tasks and return per-task outcomes. */
export async function batchCancelHistoryTasks(
  taskIds: BatchTaskActionRequest['task_ids'],
): Promise<BatchTaskActionResponse> {
  const { data } = await apiClient.post<BatchTaskActionResponse>(`${BASE}/batch/cancel`, {
    task_ids: taskIds,
  })
  return data
}

/** Retry multiple tasks and return per-task outcomes. */
export async function batchRetryHistoryTasks(
  taskIds: BatchTaskActionRequest['task_ids'],
): Promise<BatchTaskActionResponse> {
  const { data } = await apiClient.post<BatchTaskActionResponse>(`${BASE}/batch/retry`, {
    task_ids: taskIds,
  })
  return data
}
