import { useCallback, useEffect, useMemo, useRef } from 'react'

import { POLL_INTERVAL_MS } from '@/config/constants'
import { listTasks } from '@/features/tasks/api'
import { subscribeTaskRefresh } from '@/features/tasks/lib/task-refresh'
import { ACTIVE_TASK_STATUSES } from '@/features/tasks/lib/task-status-groups'
import { useSessionTasksStore } from '@/features/tasks/store/session-tasks-store'
import { useTaskBoardStore } from '@/features/tasks/store/task-board-store'

const BACKGROUND_POLL_INTERVAL_MS = 6000
const RETRY_BACKOFF_MS = [2000, 4000, 8000] as const
const TASK_LIST_LIMIT = 100

function getBasePollIntervalMs(): number {
  if (typeof document !== 'undefined' && document.hidden) {
    return BACKGROUND_POLL_INTERVAL_MS
  }
  return POLL_INTERVAL_MS
}

export interface UseTaskPollingReturn {
  refreshNow: () => Promise<void>
}

export function useTaskPolling(): UseTaskPollingReturn {
  const sessionById = useSessionTasksStore((state) => state.byId)
  const upsertSessionTask = useSessionTasksStore((state) => state.upsertSessionTask)
  const boardTasks = useTaskBoardStore((state) => state.tasks)
  const setTasks = useTaskBoardStore((state) => state.setTasks)
  const setFetching = useTaskBoardStore((state) => state.setFetching)
  const setError = useTaskBoardStore((state) => state.setError)
  const setPolling = useTaskBoardStore((state) => state.setPolling)

  const hasActiveTasks = useMemo(() => {
    const sessionActive = Object.values(sessionById).some((task) =>
      ACTIVE_TASK_STATUSES.has(task.status),
    )
    if (sessionActive) return true
    return boardTasks.some((task) => ACTIVE_TASK_STATUSES.has(task.status))
  }, [boardTasks, sessionById])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const retryIndexRef = useRef(-1)
  const hasActiveRef = useRef(hasActiveTasks)
  const wasActiveRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const sessionByIdRef = useRef(sessionById)
  const runTickRef = useRef<() => void>(() => {})

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopPolling = useCallback(() => {
    clearTimer()
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setPolling(false)
  }, [clearTimer, setPolling])

  const scheduleNext = useCallback(() => {
    clearTimer()
    if (!hasActiveRef.current) {
      setPolling(false)
      return
    }

    setPolling(true)
    const delay =
      retryIndexRef.current >= 0 ? RETRY_BACKOFF_MS[retryIndexRef.current] : getBasePollIntervalMs()

    timerRef.current = setTimeout(() => {
      runTickRef.current()
    }, delay)
  }, [clearTimer, setPolling])

  const runPoll = useCallback(
    async (force = false) => {
      if (!force && !hasActiveRef.current) {
        stopPolling()
        return
      }

      if (inFlightRef.current) return
      inFlightRef.current = true

      const controller = new AbortController()
      abortRef.current = controller
      setFetching(true)

      try {
        const response = await listTasks(
          {
            limit: TASK_LIST_LIMIT,
            sort_by: 'created_at',
            order: 'desc',
          },
          controller.signal,
        )

        setTasks(response.tasks)

        const serverById = new Map(response.tasks.map((task) => [task.task_id, task]))
        for (const taskId of Object.keys(sessionByIdRef.current)) {
          const next = serverById.get(taskId)
          if (next) {
            upsertSessionTask(next)
          }
        }

        retryIndexRef.current = -1
        setError(null)
      } catch {
        if (!controller.signal.aborted) {
          retryIndexRef.current = Math.min(retryIndexRef.current + 1, RETRY_BACKOFF_MS.length - 1)
          setError('task polling failed')
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        inFlightRef.current = false
        setFetching(false)

        if (hasActiveRef.current) {
          scheduleNext()
        } else {
          stopPolling()
        }
      }
    },
    [scheduleNext, setError, setFetching, setTasks, stopPolling, upsertSessionTask],
  )

  const refreshNow = useCallback(async () => {
    clearTimer()
    retryIndexRef.current = -1
    await runPoll(true)
  }, [clearTimer, runPoll])

  useEffect(() => {
    runTickRef.current = () => {
      void runPoll(false)
    }
  }, [runPoll])

  useEffect(() => {
    sessionByIdRef.current = sessionById
  }, [sessionById])

  useEffect(() => {
    hasActiveRef.current = hasActiveTasks

    if (hasActiveTasks && !wasActiveRef.current) {
      retryIndexRef.current = -1
      void runPoll(true)
    } else if (!hasActiveTasks && wasActiveRef.current) {
      stopPolling()
    }

    wasActiveRef.current = hasActiveTasks
  }, [hasActiveTasks, runPoll, stopPolling])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (!hasActiveRef.current) return
      if (retryIndexRef.current >= 0) return
      scheduleNext()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [scheduleNext])

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  useEffect(() => {
    return subscribeTaskRefresh(() => {
      void refreshNow()
    })
  }, [refreshNow])

  return { refreshNow }
}
