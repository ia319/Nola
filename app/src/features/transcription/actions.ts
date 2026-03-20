import { cancelTask, createTask, deleteTaskRecord } from '@/features/transcription/api'
import { requestTaskRefresh } from '@/features/transcription/lib/task-refresh'
import type {
  CancelTaskResponse,
  CreateTaskPayload,
  CreateTaskResponse,
  DeleteTaskRecordResponse,
} from '@/shared/types'

/** Keep action-triggered sync consistent across create/cancel/retry flows. */
export async function cancelTaskAndRefresh(taskId: string): Promise<CancelTaskResponse> {
  try {
    return await cancelTask(taskId)
  } finally {
    // Always refresh after cancel attempt so race outcomes (e.g. already completed)
    // are reconciled even when the request returns conflict.
    requestTaskRefresh()
  }
}

/** Keep action-triggered sync consistent across create/cancel/retry flows. */
export async function retryTaskAndRefresh(payload: CreateTaskPayload): Promise<CreateTaskResponse> {
  const response = await createTask(payload)
  requestTaskRefresh()
  return response
}

/** Keep action-triggered sync consistent for delete-record flow. */
export async function deleteTaskRecordAndRefresh(
  taskId: string,
): Promise<DeleteTaskRecordResponse> {
  try {
    return await deleteTaskRecord(taskId)
  } finally {
    requestTaskRefresh()
  }
}
