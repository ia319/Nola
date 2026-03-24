import { cancelTask, createTask, deleteTaskRecord } from '@/features/tasks/api'
import { requestTaskRefresh } from '@/features/tasks/lib/task-refresh'
import type {
  CancelTaskResponse,
  CreateTaskPayload,
  CreateTaskResponse,
  DeleteTaskRecordResponse,
} from '@/shared/types'

export async function cancelTaskAndRefresh(taskId: string): Promise<CancelTaskResponse> {
  try {
    return await cancelTask(taskId)
  } finally {
    // Always refresh after cancel attempt so race outcomes (e.g. already completed)
    // are reconciled even when the request returns conflict.
    requestTaskRefresh()
  }
}

export async function retryTaskAndRefresh(payload: CreateTaskPayload): Promise<CreateTaskResponse> {
  const response = await createTask(payload)
  requestTaskRefresh()
  return response
}

export async function deleteTaskRecordAction(taskId: string): Promise<DeleteTaskRecordResponse> {
  return deleteTaskRecord(taskId)
}
