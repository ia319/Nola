import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { listLiveSessions } from '@/features/realtime/api'
import { DEFAULT_LIVE_FILTER_STATUS } from '@/shared/lib/live-query-options'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type { AppError, LiveSessionSummary } from '@/shared/types'
import type { HistoryLiveQuery } from '@/routes/history-search'

export interface UseHistoryLiveSessionsResult {
  query: HistoryLiveQuery
  sessions: LiveSessionSummary[]
  total: number
  isLoading: boolean
  error: AppError | null
  refresh: () => Promise<void>
}

export interface UseHistoryLiveSessionsOptions {
  query: HistoryLiveQuery
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

export function useHistoryLiveSessions({
  query,
  onPageClamp,
}: UseHistoryLiveSessionsOptions): UseHistoryLiveSessionsResult {
  const limit = query.page_size
  const offset = (query.page - 1) * query.page_size
  const search = query.q.trim()
  const params = {
    q: search === '' ? undefined : search,
    status: query.status === DEFAULT_LIVE_FILTER_STATUS ? undefined : query.status,
    sort_by: query.sort_by,
    order: query.order,
    limit,
    offset,
  }

  const liveListQuery = useQuery({
    queryKey: queryKeys.live.list(params),
    queryFn: ({ signal }) => listLiveSessions(params, signal),
  })

  useEffect(() => {
    if (!liveListQuery.data) {
      return
    }

    const totalPages = Math.max(1, Math.ceil(liveListQuery.data.total / Math.max(limit, 1)))
    if (query.page > totalPages) {
      onPageClamp?.(totalPages)
    }
  }, [limit, liveListQuery.data, onPageClamp, query.page])

  return {
    query,
    sessions: liveListQuery.data?.sessions ?? [],
    total: liveListQuery.data?.total ?? 0,
    isLoading: liveListQuery.isPending,
    error: liveListQuery.error ? toAppError(liveListQuery.error) : null,
    refresh: async () => {
      await liveListQuery.refetch()
    },
  }
}
