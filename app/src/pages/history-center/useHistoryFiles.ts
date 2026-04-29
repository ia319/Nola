import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { listFiles } from '@/features/upload'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type { AppError, FileInfo } from '@/shared/types'
import type { HistoryFileQuery } from '@/routes/history-search'

export interface UseHistoryFilesResult {
  query: HistoryFileQuery
  files: FileInfo[]
  total: number
  isLoading: boolean
  error: AppError | null
  refresh: () => Promise<void>
}

export interface UseHistoryFilesOptions {
  query: HistoryFileQuery
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

export function useHistoryFiles({
  query,
  onPageClamp,
}: UseHistoryFilesOptions): UseHistoryFilesResult {
  const limit = query.page_size
  const offset = (query.page - 1) * query.page_size
  const search = query.q.trim()
  const contentType =
    query.content_type === 'all' || query.content_type.trim() === ''
      ? undefined
      : query.content_type.trim()
  const params = {
    q: search === '' ? undefined : search,
    content_type: contentType,
    sort_by: query.sort_by,
    order: query.order,
    limit,
    offset,
  }

  const fileListQuery = useQuery({
    queryKey: queryKeys.files.list(params),
    queryFn: ({ signal }) => listFiles(params, signal),
  })

  useEffect(() => {
    if (!fileListQuery.data) {
      return
    }

    const totalPages = Math.max(1, Math.ceil(fileListQuery.data.total / Math.max(limit, 1)))
    if (query.page > totalPages) {
      onPageClamp?.(totalPages)
    }
  }, [fileListQuery.data, limit, onPageClamp, query.page])

  return {
    query,
    files: fileListQuery.data?.files ?? [],
    total: fileListQuery.data?.total ?? 0,
    isLoading: fileListQuery.isPending,
    error: fileListQuery.error ? toAppError(fileListQuery.error) : null,
    refresh: async () => {
      await fileListQuery.refetch()
    },
  }
}
