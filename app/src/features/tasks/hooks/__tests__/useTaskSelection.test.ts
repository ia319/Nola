// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TaskSummary } from '@/shared/types'

import { useTaskSelection } from '../useTaskSelection'

function buildTask(taskId: string): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `${taskId}.mp3`,
    status: 'pending',
    progress: 0,
    created_at: '2026-03-24T10:00:00.000Z',
    completed_at: null,
  }
}

describe('useTaskSelection', () => {
  it('selects and clears current page ids', () => {
    const tasks = [buildTask('task-1'), buildTask('task-2')]
    const { result } = renderHook(() => useTaskSelection(tasks))

    expect(result.current.selectedTaskIds).toEqual([])

    act(() => {
      result.current.toggleCurrentPage()
    })
    expect(result.current.allCurrentPageSelected).toBe(true)
    expect(result.current.selectedTaskIds).toEqual(['task-1', 'task-2'])

    act(() => {
      result.current.toggleCurrentPage()
    })
    expect(result.current.allCurrentPageSelected).toBe(false)
    expect(result.current.selectedTaskIds).toEqual([])
  })

  it('resets selection when reset token changes', () => {
    const tasks = [buildTask('task-1')]
    const { result, rerender } = renderHook(
      ({ token }) =>
        useTaskSelection(tasks, {
          resetToken: token,
        }),
      {
        initialProps: { token: 'a' },
      },
    )

    act(() => {
      result.current.toggleTask('task-1', true)
    })
    expect(result.current.selectedTaskIds).toEqual(['task-1'])

    rerender({ token: 'b' })
    expect(result.current.selectedTaskIds).toEqual([])
  })

  it('prunes selected ids not present in current task page', () => {
    const tasks = [buildTask('task-1'), buildTask('task-2')]
    const { result, rerender } = renderHook(({ input }) => useTaskSelection(input), {
      initialProps: { input: tasks },
    })

    act(() => {
      result.current.toggleTask('task-1', true)
    })
    expect(result.current.selectedTaskIds).toEqual(['task-1'])

    rerender({ input: [buildTask('task-2')] })
    expect(result.current.selectedTaskIds).toEqual([])
  })
})
