import { describe, expect, it } from 'vitest'

import type { TaskSummary } from '@/shared/types'

import { selectActiveTasks, selectRecentTerminalTasks } from '../task-selectors'

function buildTask(
  taskId: string,
  status: TaskSummary['status'],
  createdAt: string,
  completedAt: string | null = null,
): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    status,
    progress: status === 'completed' ? 100 : 0,
    created_at: createdAt,
    completed_at: completedAt,
  }
}

describe('task selectors', () => {
  it('selects active tasks and sorts by created_at descending', () => {
    const tasks = [
      buildTask('task-a', 'pending', '2026-03-18T09:00:00.000Z'),
      buildTask('task-b', 'processing', '2026-03-18T10:00:00.000Z'),
      buildTask('task-c', 'completed', '2026-03-18T11:00:00.000Z', '2026-03-18T11:10:00.000Z'),
    ]

    const active = selectActiveTasks(tasks)
    expect(active.map((task) => task.task_id)).toEqual(['task-b', 'task-a'])
  })

  it('selects terminal tasks by completion recency and limits count', () => {
    const tasks = [
      buildTask('task-a', 'completed', '2026-03-18T08:00:00.000Z', '2026-03-18T08:10:00.000Z'),
      buildTask('task-b', 'failed', '2026-03-18T09:00:00.000Z', '2026-03-18T10:10:00.000Z'),
      buildTask('task-c', 'cancelled', '2026-03-18T10:00:00.000Z', '2026-03-18T10:05:00.000Z'),
      buildTask('task-d', 'processing', '2026-03-18T11:00:00.000Z'),
    ]

    const recent = selectRecentTerminalTasks(tasks, 2)
    expect(recent.map((task) => task.task_id)).toEqual(['task-b', 'task-c'])
  })

  it('returns empty list when maxCount is zero or negative', () => {
    const tasks = [buildTask('task-a', 'completed', '2026-03-18T08:00:00.000Z')]
    expect(selectRecentTerminalTasks(tasks, 0)).toEqual([])
    expect(selectRecentTerminalTasks(tasks, -1)).toEqual([])
  })
})
