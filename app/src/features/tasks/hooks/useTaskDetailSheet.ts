import { useCallback, useRef, useState } from 'react'

import type { TaskSummary } from '@/shared/types'

export interface UseTaskDetailSheetOptions<ActionId extends string = string> {
  onActionError?: (action: ActionId, error: unknown) => void
}

export interface UseTaskDetailSheetResult<ActionId extends string = string> {
  open: boolean
  selectedTask: TaskSummary | null
  runningAction: ActionId | null
  openTaskDetail: (task: TaskSummary) => void
  closeTaskDetail: () => void
  onOpenChange: (open: boolean) => void
  runDetailAction: (action: ActionId, handler: () => void | Promise<void>) => Promise<void>
}

/**
 * Manage task detail selection and one-at-a-time detail actions.
 */
export function useTaskDetailSheet<ActionId extends string = string>({
  onActionError,
}: UseTaskDetailSheetOptions<ActionId> = {}): UseTaskDetailSheetResult<ActionId> {
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null)
  const [runningActionsByTaskId, setRunningActionsByTaskId] = useState<
    ReadonlyMap<string, ActionId>
  >(() => new Map())
  const runningActionsRef = useRef<Map<string, ActionId>>(new Map())
  const runningAction = selectedTask
    ? (runningActionsByTaskId.get(selectedTask.task_id) ?? null)
    : null

  const closeTaskDetail = useCallback(() => {
    setSelectedTask(null)
  }, [])

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeTaskDetail()
      }
    },
    [closeTaskDetail],
  )

  const runDetailAction = useCallback(
    async (action: ActionId, handler: () => void | Promise<void>): Promise<void> => {
      if (!selectedTask) {
        return
      }

      const taskId = selectedTask.task_id
      if (runningActionsRef.current.has(taskId)) {
        return
      }

      runningActionsRef.current.set(taskId, action)
      setRunningActionsByTaskId(new Map(runningActionsRef.current))
      try {
        await handler()
      } catch (error: unknown) {
        onActionError?.(action, error)
      } finally {
        if (runningActionsRef.current.get(taskId) === action) {
          runningActionsRef.current.delete(taskId)
          setRunningActionsByTaskId(new Map(runningActionsRef.current))
        }
      }
    },
    [onActionError, selectedTask],
  )

  return {
    open: selectedTask !== null,
    selectedTask,
    runningAction,
    openTaskDetail: setSelectedTask,
    closeTaskDetail,
    onOpenChange,
    runDetailAction,
  }
}
