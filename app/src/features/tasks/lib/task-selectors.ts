import type { TaskSummary } from '@/shared/types'

import { ACTIVE_TASK_STATUSES, TERMINAL_TASK_STATUSES } from './task-status-groups'

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

export function selectActiveTasks(tasks: TaskSummary[]): TaskSummary[] {
  return tasks
    .filter((task) => ACTIVE_TASK_STATUSES.has(task.status))
    .slice()
    .sort(compareByCreatedAtDesc)
}

export function selectRecentTerminalTasks(
  tasks: TaskSummary[],
  maxCount: number = Number.POSITIVE_INFINITY,
): TaskSummary[] {
  if (maxCount <= 0) return []

  return tasks
    .filter((task) => TERMINAL_TASK_STATUSES.has(task.status))
    .slice()
    .sort(compareByTerminalRecency)
    .slice(0, maxCount)
}
