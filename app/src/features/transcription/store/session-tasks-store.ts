import { create } from 'zustand'

import type { TaskStatus, TaskSummary } from '@/shared/types'

export type SessionTask = TaskSummary

export type SessionTaskInput = Pick<TaskSummary, 'task_id' | 'file_id' | 'status'> &
  Partial<Pick<TaskSummary, 'progress' | 'created_at' | 'completed_at'>>

export interface SessionTasksState {
  order: string[]
  byId: Record<string, SessionTask>
  addCreatedTask: (task: SessionTaskInput) => void
  upsertSessionTask: (task: SessionTaskInput) => void
  removeSessionTask: (taskId: string) => void
  clearSession: () => void
}

function isTerminalStatus(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

function normalizeSessionTask(task: SessionTaskInput): SessionTask {
  const status = task.status
  const createdAt = task.created_at ?? new Date().toISOString()
  const completedAt = task.completed_at ?? (isTerminalStatus(status) ? createdAt : null)

  return {
    task_id: task.task_id,
    file_id: task.file_id,
    status,
    progress: task.progress ?? (status === 'completed' ? 100 : 0),
    created_at: createdAt,
    completed_at: completedAt,
  }
}

function upsertState(
  state: Pick<SessionTasksState, 'order' | 'byId'>,
  input: SessionTaskInput,
): Pick<SessionTasksState, 'order' | 'byId'> {
  const normalized = normalizeSessionTask(input)
  const exists = Boolean(state.byId[normalized.task_id])

  return {
    order: exists ? state.order : [normalized.task_id, ...state.order],
    byId: {
      ...state.byId,
      [normalized.task_id]: normalized,
    },
  }
}

/**
 * Store session-scoped recent tasks.
 *
 * Keep data in memory only and reset only when app process restarts
 * or clearSession is explicitly called.
 */
export const useSessionTasksStore = create<SessionTasksState>((set) => ({
  order: [],
  byId: {},

  addCreatedTask: (task) =>
    set((state) => {
      return upsertState(state, task)
    }),

  upsertSessionTask: (task) =>
    set((state) => {
      return upsertState(state, task)
    }),

  removeSessionTask: (taskId) =>
    set((state) => {
      const nextById = { ...state.byId }
      delete nextById[taskId]

      return {
        order: state.order.filter((id) => id !== taskId),
        byId: nextById,
      }
    }),

  clearSession: () =>
    set({
      order: [],
      byId: {},
    }),
}))
