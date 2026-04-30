import type { TaskStatus } from '@/shared/types'

const TASK_STATUS_OPTION_FLAGS: Record<TaskStatus, true> = {
  pending: true,
  processing: true,
  completed: true,
  failed: true,
  cancelled: true,
}

const ACTIVE_TASK_STATUS_RULES: Record<TaskStatus, boolean> = {
  pending: true,
  processing: true,
  completed: false,
  failed: false,
  cancelled: false,
}

const TERMINAL_TASK_STATUS_RULES: Record<TaskStatus, boolean> = {
  pending: false,
  processing: false,
  completed: true,
  failed: true,
  cancelled: true,
}

const RETRYABLE_TASK_STATUS_RULES: Record<TaskStatus, boolean> = {
  pending: false,
  processing: false,
  completed: false,
  failed: true,
  cancelled: true,
}

const COMPLETED_TASK_STATUS_RULES: Record<TaskStatus, boolean> = {
  pending: false,
  processing: false,
  completed: true,
  failed: false,
  cancelled: false,
}

function toStatusSet(rules: Record<TaskStatus, boolean>): ReadonlySet<TaskStatus> {
  return new Set(
    Object.entries(rules)
      .filter(([, enabled]) => enabled)
      .map(([status]) => status as TaskStatus),
  )
}

export const TASK_STATUS_OPTIONS = Object.keys(TASK_STATUS_OPTION_FLAGS) as readonly TaskStatus[]

export const ACTIVE_TASK_STATUSES = toStatusSet(ACTIVE_TASK_STATUS_RULES)

export const TERMINAL_TASK_STATUSES = toStatusSet(TERMINAL_TASK_STATUS_RULES)

export const RETRYABLE_TASK_STATUSES = toStatusSet(RETRYABLE_TASK_STATUS_RULES)

export const DELETABLE_TASK_RECORD_STATUSES = TERMINAL_TASK_STATUSES

export const COMPLETED_TASK_STATUSES = toStatusSet(COMPLETED_TASK_STATUS_RULES)

export const EXPORTABLE_TASK_STATUSES = COMPLETED_TASK_STATUSES

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
