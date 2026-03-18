import { create } from 'zustand'

import type { TaskSummary } from '@/shared/types'

export interface TaskBoardState {
  tasks: TaskSummary[]
  isFetching: boolean
  lastSyncedAt: number | null
  error: string | null
  setTasks: (tasks: TaskSummary[]) => void
  upsertTask: (task: TaskSummary) => void
  removeTask: (taskId: string) => void
  setFetching: (value: boolean) => void
  setError: (message: string | null) => void
  clearTaskBoard: () => void
}

function dedupeTasks(tasks: TaskSummary[]): TaskSummary[] {
  const seen = new Set<string>()
  const deduped: TaskSummary[] = []

  for (const task of tasks) {
    if (seen.has(task.task_id)) continue
    seen.add(task.task_id)
    deduped.push(task)
  }

  return deduped
}

/**
 * Store task board data shared by home panels.
 */
export const useTaskBoardStore = create<TaskBoardState>((set) => ({
  tasks: [],
  isFetching: false,
  lastSyncedAt: null,
  error: null,

  setTasks: (tasks) =>
    set({
      tasks: dedupeTasks(tasks),
      lastSyncedAt: Date.now(),
      error: null,
    }),

  upsertTask: (task) =>
    set((state) => {
      const index = state.tasks.findIndex((item) => item.task_id === task.task_id)
      if (index < 0) {
        return {
          tasks: [task, ...state.tasks],
        }
      }

      const next = [...state.tasks]
      next[index] = task
      return { tasks: next }
    }),

  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.task_id !== taskId),
    })),

  setFetching: (value) =>
    set({
      isFetching: value,
    }),

  setError: (message) =>
    set({
      error: message,
    }),

  clearTaskBoard: () =>
    set({
      tasks: [],
      isFetching: false,
      lastSyncedAt: null,
      error: null,
    }),
}))
