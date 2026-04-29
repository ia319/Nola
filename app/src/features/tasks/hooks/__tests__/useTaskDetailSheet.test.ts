// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TaskSummary } from '@/shared/types'
import { useTaskDetailSheet } from '../useTaskDetailSheet'

function buildTask(taskId: string): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `${taskId}.wav`,
    status: 'completed',
    progress: 100,
    created_at: '2026-04-20T10:00:00.000Z',
    completed_at: '2026-04-20T10:05:00.000Z',
  }
}

function createDeferred<T = void>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useTaskDetailSheet', () => {
  it('scopes running actions to the selected task', async () => {
    const taskA = buildTask('task-a')
    const taskB = buildTask('task-b')
    const firstAction = createDeferred()
    const secondHandler = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useTaskDetailSheet<'delete' | 'retry'>())

    act(() => {
      result.current.openTaskDetail(taskA)
    })
    act(() => {
      void result.current.runDetailAction('delete', () => firstAction.promise)
    })
    expect(result.current.runningAction).toBe('delete')

    act(() => {
      result.current.closeTaskDetail()
      result.current.openTaskDetail(taskB)
    })
    expect(result.current.runningAction).toBeNull()

    await act(async () => {
      await result.current.runDetailAction('retry', secondHandler)
    })

    expect(secondHandler).toHaveBeenCalledTimes(1)

    await act(async () => {
      firstAction.resolve()
      await firstAction.promise
    })
  })
})
