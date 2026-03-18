import type { TaskSummary } from '@/shared/types'

const ACTIVE_STATUSES = new Set(['pending', 'processing'])
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

function toTimestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function compareByCreatedAtDesc(a: TaskSummary, b: TaskSummary): number {
  const timeDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at)
  if (timeDiff !== 0) return timeDiff
  return b.task_id.localeCompare(a.task_id)
}

function compareByTerminalRecency(a: TaskSummary, b: TaskSummary): number {
  const completedDiff = toTimestamp(b.completed_at) - toTimestamp(a.completed_at)
  if (completedDiff !== 0) return completedDiff
  return compareByCreatedAtDesc(a, b)
}

/**
 * Select active tasks from one list and order by created_at descending.
 */
export function selectActiveTasks(tasks: TaskSummary[]): TaskSummary[] {
  return tasks
    .filter((task) => ACTIVE_STATUSES.has(task.status))
    .slice()
    .sort(compareByCreatedAtDesc)
}

/**
 * Select recent terminal tasks from one list and cap result size.
 */
export function selectRecentTerminalTasks(
  tasks: TaskSummary[],
  maxCount: number = Number.POSITIVE_INFINITY,
): TaskSummary[] {
  if (maxCount <= 0) return []

  return tasks
    .filter((task) => TERMINAL_STATUSES.has(task.status))
    .slice()
    .sort(compareByTerminalRecency)
    .slice(0, maxCount)
}
