import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { listHistoryTasks } from '@/features/tasks/history/api'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
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

export function useHistoryTasks({
  query,
  onPageClamp,
}: UseHistoryTasksOptions): UseHistoryTasksResult {
  const limit = query.page_size
  const offset = (query.page - 1) * query.page_size
  const params = {
    q: query.q.trim() === '' ? undefined : query.q.trim(),
    status: query.status === 'all' ? undefined : query.status,
    sort_by: query.sort_by,
    order: query.order,
    limit,
    offset,
  }

  const taskListQuery = useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: ({ signal }) => listHistoryTasks(params, signal),
  })

  useEffect(() => {
    if (!taskListQuery.data) {
      return
    }

    const totalPages = Math.max(1, Math.ceil(taskListQuery.data.total / Math.max(limit, 1)))
    if (query.page > totalPages) {
      onPageClamp?.(totalPages)
    }
  }, [limit, onPageClamp, query.page, taskListQuery.data])

  return {
    query,
    tasks: taskListQuery.data?.tasks ?? [],
    total: taskListQuery.data?.total ?? 0,
    isLoading: taskListQuery.isPending,
    error: taskListQuery.error ? toAppError(taskListQuery.error) : null,
    refresh: async () => {
      await taskListQuery.refetch()
    },
  }
}
