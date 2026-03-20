// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TaskSummary } from '@/shared/types'

import { useRecentTaskQuery } from '../useRecentTaskQuery'

function buildTask(
  taskId: string,
  status: TaskSummary['status'],
  overrides: Partial<TaskSummary> = {},
): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `audio-${taskId}.mp3`,
    status,
    progress: status === 'completed' ? 100 : 25,
    created_at: '2026-03-20T09:00:00.000Z',
    completed_at: status === 'completed' ? '2026-03-20T09:10:00.000Z' : null,
    ...overrides,
  }
}

describe('useRecentTaskQuery', () => {
  it('filters by keyword and status then paginates locally', () => {
    const sourceTasks = [
      buildTask('task-1', 'pending', { filename: 'alpha.mp3' }),
      buildTask('task-2', 'failed', { filename: 'beta.mp3' }),
      buildTask('task-3', 'failed', { filename: 'gamma.mp3' }),
    ]

    const { result } = renderHook(() => useRecentTaskQuery(sourceTasks, 1))

    act(() => {
      result.current.setStatus('failed')
    })
    expect(result.current.total).toBe(2)
    expect(result.current.tasks).toHaveLength(1)

    act(() => {
      result.current.setSearch('gamma')
    })
    expect(result.current.total).toBe(1)
    expect(result.current.tasks[0]?.task_id).toBe('task-3')
  })

  it('supports sort switching and deterministic page reset on query changes', () => {
    const sourceTasks = [
      buildTask('task-1', 'processing', { progress: 90 }),
      buildTask('task-2', 'processing', { progress: 10 }),
      buildTask('task-3', 'processing', { progress: 50 }),
    ]

    const { result } = renderHook(() => useRecentTaskQuery(sourceTasks, 2))

    act(() => {
      result.current.setPage(2)
    })
    expect(result.current.query.page).toBe(2)

    act(() => {
      result.current.setSortBy('progress')
      result.current.setOrder('asc')
    })
    expect(result.current.query.page).toBe(1)
    expect(result.current.tasks.map((task) => task.task_id)).toEqual(['task-2', 'task-3'])
  })
})
