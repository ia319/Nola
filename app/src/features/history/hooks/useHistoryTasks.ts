import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { listHistoryTasks } from '@/features/history/api'
import { isAppError } from '@/shared/lib/error-factory'
import type { AppError, TaskQueryModel, TaskSummary } from '@/shared/types'

export interface UseHistoryTasksResult {
  query: TaskQueryModel
  tasks: TaskSummary[]
  total: number
  isLoading: boolean
  error: AppError | null
  refresh: () => Promise<void>
}

export interface UseHistoryTasksOptions {
  query: TaskQueryModel
  onPageClamp?: (page: number) => void
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

/**
 * Keep history backend pagination fetch logic independent from route state wiring.
 */
export function useHistoryTasks({
  query,
  onPageClamp,
}: UseHistoryTasksOptions): UseHistoryTasksResult {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipQuerySignatureRef = useRef<string | null>(null)

  const querySignature = useMemo(() => {
    return `${query.q}|${query.status}|${query.sort_by}|${query.order}|${query.page}|${query.page_size}`
  }, [query.order, query.page, query.page_size, query.q, query.sort_by, query.status])

  const refresh = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)

    const baseParams = {
      q: query.q.trim() === '' ? undefined : query.q.trim(),
      status: query.status === 'all' ? undefined : query.status,
      sort_by: query.sort_by,
      order: query.order,
      limit: query.page_size,
    }

    try {
      const response = await listHistoryTasks(
        {
          ...baseParams,
          offset: (query.page - 1) * query.page_size,
        },
        controller.signal,
      )

      if (controller.signal.aborted) return

      const totalPages = Math.max(1, Math.ceil(response.total / Math.max(query.page_size, 1)))
      if (query.page > totalPages) {
        const clampedResponse = await listHistoryTasks(
          {
            ...baseParams,
            offset: (totalPages - 1) * query.page_size,
          },
          controller.signal,
        )

        if (controller.signal.aborted) return

        // Skip one follow-up request when route state catches up to clamped page.
        skipQuerySignatureRef.current = `${query.q}|${query.status}|${query.sort_by}|${query.order}|${totalPages}|${query.page_size}`
        setTasks(clampedResponse.tasks)
        setTotal(clampedResponse.total)
        onPageClamp?.(totalPages)
        return
      }

      setTasks(response.tasks)
      setTotal(response.total)
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      setError(toAppError(err))
      setTasks([])
      setTotal(0)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [onPageClamp, query.order, query.page, query.page_size, query.q, query.sort_by, query.status])

  useEffect(() => {
    if (skipQuerySignatureRef.current === querySignature) {
      skipQuerySignatureRef.current = null
      return
    }
    void refresh()
  }, [querySignature, refresh])

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  return {
    query,
    tasks,
    total,
    isLoading,
    error,
    refresh,
  }
}
