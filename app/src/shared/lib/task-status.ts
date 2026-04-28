import type { TaskStatus } from '@/shared/types'

export const TASK_STATUS_OPTIONS = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const satisfies readonly TaskStatus[]

export const ACTIVE_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['pending', 'processing'])

export const TERMINAL_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
])

export const RETRYABLE_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['failed', 'cancelled'])

export const DELETABLE_TASK_RECORD_STATUSES: ReadonlySet<TaskStatus> = TERMINAL_TASK_STATUSES

export const COMPLETED_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['completed'])

export const EXPORTABLE_TASK_STATUSES: ReadonlySet<TaskStatus> = COMPLETED_TASK_STATUSES

/**
 * Check whether a task can still receive active-task operations.
 *
 * @param status Task status from the backend response.
 * @returns True when the task is pending or processing.
 */
export function isActiveTaskStatus(status: TaskStatus): boolean {
  return ACTIVE_TASK_STATUSES.has(status)
}

/**
 * Check whether a task has reached a terminal backend state.
 *
 * @param status Task status from the backend response.
 * @returns True when the task no longer runs.
 */
export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.has(status)
}

/**
 * Check whether a task completed successfully.
 *
 * @param status Task status from the backend response.
 * @returns True when the task has completed.
 */
export function isCompletedTaskStatus(status: TaskStatus): boolean {
  return COMPLETED_TASK_STATUSES.has(status)
}

/**
 * Check whether a task can be retried from its current status.
 *
 * @param status Task status from the backend response.
 * @returns True when retry should be offered.
 */
export function isRetryableTaskStatus(status: TaskStatus): boolean {
  return RETRYABLE_TASK_STATUSES.has(status)
}

/**
 * Check whether a persisted task record can be deleted.
 *
 * @param status Task status from the backend response.
 * @returns True when delete-record should be offered.
 */
export function isDeletableTaskRecordStatus(status: TaskStatus): boolean {
  return DELETABLE_TASK_RECORD_STATUSES.has(status)
}

/**
 * Check whether a task can export completed transcription output.
 *
 * @param status Task status from the backend response.
 * @returns True when export should be offered.
 */
export function isExportableTaskStatus(status: TaskStatus): boolean {
  return EXPORTABLE_TASK_STATUSES.has(status)
}
