import { useCallback, useEffect, useRef, useState } from 'react'

import { HISTORY_PAGE_SIZE } from '@/config/constants'
import { listHistoryTasks } from '@/features/history/api'
import { isAppError } from '@/shared/lib/error-factory'
import type {
  AppError,
  SortOrder,
  TaskFilterStatus,
  TaskQueryModel,
  TaskSortBy,
  TaskSummary,
} from '@/shared/types'

export interface UseHistoryTasksResult {
  query: TaskQueryModel
  tasks: TaskSummary[]
  total: number
  isLoading: boolean
  error: AppError | null
  setSearch: (value: string) => void
  setStatus: (value: TaskFilterStatus) => void
  setSortBy: (value: TaskSortBy) => void
  setOrder: (value: SortOrder) => void
  setPage: (value: number) => void
  refresh: () => Promise<void>
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
 * Keep history query state and backend pagination in one reusable hook.
 */
export function useHistoryTasks(pageSize: number = HISTORY_PAGE_SIZE): UseHistoryTasksResult {
  const [query, setQuery] = useState<TaskQueryModel>({
    q: '',
    status: 'all',
    sort_by: 'created_at',
    order: 'desc',
    page: 1,
    page_size: pageSize,
  })
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipNextEffectRefreshRef = useRef(false)
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

        // Keep query.page synchronized without triggering a redundant refresh cycle.
        skipNextEffectRefreshRef.current = true
        setQuery((previous) => ({
          ...previous,
          page: totalPages,
        }))
        setTasks(clampedResponse.tasks)
        setTotal(clampedResponse.total)
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
  }, [query.order, query.page, query.page_size, query.q, query.sort_by, query.status])

  useEffect(() => {
    if (skipNextEffectRefreshRef.current) {
      skipNextEffectRefreshRef.current = false
      return
    }
    void refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  const setSearch = useCallback((value: string) => {
    setQuery((previous) => ({
      ...previous,
      q: value,
      page: 1,
    }))
  }, [])

  const setStatus = useCallback((value: TaskFilterStatus) => {
    setQuery((previous) => ({
      ...previous,
      status: value,
      page: 1,
    }))
  }, [])

  const setSortBy = useCallback((value: TaskSortBy) => {
    setQuery((previous) => ({
      ...previous,
      sort_by: value,
      page: 1,
    }))
  }, [])

  const setOrder = useCallback((value: SortOrder) => {
    setQuery((previous) => ({
      ...previous,
      order: value,
      page: 1,
    }))
  }, [])

  const setPage = useCallback((value: number) => {
    setQuery((previous) => ({
      ...previous,
      page: Math.max(1, value),
    }))
  }, [])

  return {
    query,
    tasks,
    total,
    isLoading,
    error,
    setSearch,
    setStatus,
    setSortBy,
    setOrder,
    setPage,
    refresh,
  }
}
