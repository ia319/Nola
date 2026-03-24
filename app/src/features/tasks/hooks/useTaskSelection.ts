import { useMemo, useState } from 'react'

import type { TaskSummary } from '@/shared/types'

export interface UseTaskSelectionOptions {
  resetToken?: string
}

export interface UseTaskSelectionResult {
  selectedTaskIds: string[]
  selectedTaskIdSet: ReadonlySet<string>
  allCurrentPageSelected: boolean
  toggleTask: (taskId: string, checked: boolean) => void
  toggleCurrentPage: () => void
  clearSelection: () => void
}

export function useTaskSelection(
  tasks: TaskSummary[],
  options: UseTaskSelectionOptions = {},
): UseTaskSelectionResult {
  const [selectionState, setSelectionState] = useState<{
    resetToken: string | undefined
    ids: string[]
  }>(() => ({
    resetToken: options.resetToken,
    ids: [],
  }))

  const currentPageTaskIds = useMemo(() => {
    return tasks.map((task) => task.task_id)
  }, [tasks])

  const currentPageTaskIdSet = useMemo(() => {
    return new Set(currentPageTaskIds)
  }, [currentPageTaskIds])

  const rawSelectedTaskIds = useMemo(() => {
    return selectionState.resetToken === options.resetToken ? selectionState.ids : []
  }, [options.resetToken, selectionState.ids, selectionState.resetToken])

  const selectedTaskIds = useMemo(() => {
    return rawSelectedTaskIds.filter((taskId) => currentPageTaskIdSet.has(taskId))
  }, [currentPageTaskIdSet, rawSelectedTaskIds])

  const selectedTaskIdSet = useMemo(() => {
    return new Set(selectedTaskIds)
  }, [selectedTaskIds])

  const allCurrentPageSelected =
    currentPageTaskIds.length > 0 &&
    currentPageTaskIds.every((taskId) => selectedTaskIdSet.has(taskId))

  function getScopedSelectedIds(previous: {
    resetToken: string | undefined
    ids: string[]
  }): string[] {
    const previousIds = previous.resetToken === options.resetToken ? previous.ids : []
    return previousIds.filter((taskId) => currentPageTaskIdSet.has(taskId))
  }

  function toggleTask(taskId: string, checked: boolean): void {
    setSelectionState((previous) => {
      const scopedIds = getScopedSelectedIds(previous)
      if (checked) {
        if (scopedIds.includes(taskId)) {
          return {
            resetToken: options.resetToken,
            ids: scopedIds,
          }
        }
        return {
          resetToken: options.resetToken,
          ids: [...scopedIds, taskId],
        }
      }
      return {
        resetToken: options.resetToken,
        ids: scopedIds.filter((value) => value !== taskId),
      }
    })
  }

  function toggleCurrentPage(): void {
    setSelectionState((previous) => {
      const scopedIds = getScopedSelectedIds(previous)
      if (allCurrentPageSelected) {
        return {
          resetToken: options.resetToken,
          ids: scopedIds.filter((taskId) => !currentPageTaskIds.includes(taskId)),
        }
      }

      const next = new Set(scopedIds)
      for (const taskId of currentPageTaskIds) {
        next.add(taskId)
      }
      return {
        resetToken: options.resetToken,
        ids: Array.from(next),
      }
    })
  }

  function clearSelection(): void {
    setSelectionState({
      resetToken: options.resetToken,
      ids: [],
    })
  }

  return {
    selectedTaskIds,
    selectedTaskIdSet,
    allCurrentPageSelected,
    toggleTask,
    toggleCurrentPage,
    clearSelection,
  }
}
