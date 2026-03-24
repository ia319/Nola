import { create } from 'zustand'

import type { TaskSummary } from '@/shared/types'

export interface TaskBoardState {
  tasks: TaskSummary[]
  isPolling: boolean
  isFetching: boolean
  lastSyncedAt: number | null
  error: string | null
  setTasks: (tasks: TaskSummary[]) => void
  upsertTask: (task: TaskSummary) => void
  removeTask: (taskId: string) => void
  setPolling: (value: boolean) => void
  setFetching: (value: boolean) => void
  setError: (message: string | null) => void
  clearTaskBoard: () => void
}

function dedupeTasks(tasks: TaskSummary[]): TaskSummary[] {
  const latestById = new Map<string, TaskSummary>()
  for (const task of tasks) {
    // Keep first-seen order and let later duplicates overwrite payload.
    latestById.set(task.task_id, task)
  }
  return Array.from(latestById.values())
}

export const useTaskBoardStore = create<TaskBoardState>((set) => ({
  tasks: [],
  isPolling: false,
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

  setPolling: (value) =>
    set({
      isPolling: value,
    }),

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
      isPolling: false,
      isFetching: false,
      lastSyncedAt: null,
      error: null,
    }),
}))
