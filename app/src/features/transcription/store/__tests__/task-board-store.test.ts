import { afterEach, describe, expect, it } from 'vitest'

import type { TaskSummary } from '@/shared/types'

import { useTaskBoardStore } from '../task-board-store'

function buildTask(taskId: string, overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    status: 'pending',
    progress: 0,
    created_at: '2026-03-18T09:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

afterEach(() => {
  useTaskBoardStore.getState().clearTaskBoard()
})

describe('task board store', () => {
  it('sets task list with latest duplicate wins and sync metadata', () => {
    const store = useTaskBoardStore.getState()
    store.setError('network')

    store.setTasks([
      buildTask('task-1'),
      buildTask('task-1', { progress: 60 }),
      buildTask('task-2'),
    ])

    const snapshot = useTaskBoardStore.getState()
    expect(snapshot.tasks.map((task) => task.task_id)).toEqual(['task-1', 'task-2'])
    expect(snapshot.tasks.find((task) => task.task_id === 'task-1')?.progress).toBe(60)
    expect(snapshot.error).toBeNull()
    expect(snapshot.lastSyncedAt).not.toBeNull()
  })

  it('upserts existing task and prepends a new task', () => {
    const store = useTaskBoardStore.getState()
    store.setTasks([buildTask('task-1'), buildTask('task-2')])

    store.upsertTask(buildTask('task-2', { status: 'processing', progress: 20 }))
    store.upsertTask(buildTask('task-3', { status: 'pending' }))

    const snapshot = useTaskBoardStore.getState()
    expect(snapshot.tasks.map((task) => task.task_id)).toEqual(['task-3', 'task-1', 'task-2'])
    expect(snapshot.tasks.find((task) => task.task_id === 'task-2')?.status).toBe('processing')
    expect(snapshot.tasks.find((task) => task.task_id === 'task-2')?.progress).toBe(20)
  })

  it('removes tasks and toggles fetch/error flags', () => {
    const store = useTaskBoardStore.getState()
    store.setTasks([buildTask('task-1'), buildTask('task-2')])
    store.removeTask('task-1')
    store.setFetching(true)
    store.setError('failed')

    const snapshot = useTaskBoardStore.getState()
    expect(snapshot.tasks.map((task) => task.task_id)).toEqual(['task-2'])
    expect(snapshot.isFetching).toBe(true)
    expect(snapshot.error).toBe('failed')
  })
})
