import type {
  BatchTaskActionRequest,
  BatchTaskActionResponse,
  SortOrder,
  TaskListResponse,
  TaskSortBy,
  TaskStatus,
} from '@/shared/types'

import { batchCancelTasks, batchRetryTasks, listTasks } from '@/features/tasks/api'

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
  return listTasks(params, signal)
}

export async function batchCancelHistoryTasks(
  taskIds: BatchTaskActionRequest['task_ids'],
): Promise<BatchTaskActionResponse> {
  return batchCancelTasks(taskIds)
}

export async function batchRetryHistoryTasks(
  taskIds: BatchTaskActionRequest['task_ids'],
): Promise<BatchTaskActionResponse> {
  return batchRetryTasks(taskIds)
}
