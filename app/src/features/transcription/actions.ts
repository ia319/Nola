import { cancelTask, createTask } from '@/features/transcription/api'
import { requestTaskRefresh } from '@/features/transcription/lib/task-refresh'
import type { CancelTaskResponse, CreateTaskPayload, CreateTaskResponse } from '@/shared/types'

/** Keep action-triggered sync consistent across create/cancel/retry flows. */
export async function cancelTaskAndRefresh(taskId: string): Promise<CancelTaskResponse> {
  const response = await cancelTask(taskId)
  requestTaskRefresh()
  return response
}

/** Keep action-triggered sync consistent across create/cancel/retry flows. */
export async function retryTaskAndRefresh(payload: CreateTaskPayload): Promise<CreateTaskResponse> {
  const response = await createTask(payload)
  requestTaskRefresh()
  return response
}
