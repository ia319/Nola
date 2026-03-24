import type { TaskStatus } from '@/shared/types'

export const ACTIVE_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['pending', 'processing'])

export const TERMINAL_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
])

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.has(status)
}
