import type {
  BatchTaskActionRequest,
  BatchTaskActionResponse,
  TaskListApiQuery,
  TaskListResponse,
} from '@/shared/types'

import {
  batchCancelTasks,
  batchDeleteTaskRecords,
  batchRetryTasks,
  listTasks,
} from '@/features/tasks/api'

export async function listHistoryTasks(
  params: TaskListApiQuery = {},
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

export async function batchDeleteHistoryTaskRecords(
  taskIds: BatchTaskActionRequest['task_ids'],
): Promise<BatchTaskActionResponse> {
  return batchDeleteTaskRecords(taskIds)
}
