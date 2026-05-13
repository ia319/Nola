import { useQuery } from '@tanstack/react-query'

import { getLiveSession } from '@/features/realtime/api'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type { AppError, LiveSessionDetail } from '@/shared/types'

export interface UseHistoryLiveDetailResult {
  session: LiveSessionDetail | null
  isLoading: boolean
  error: AppError | null
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

export function useHistoryLiveDetail(sessionId: string | null): UseHistoryLiveDetailResult {
  const liveDetailQuery = useQuery({
    enabled: Boolean(sessionId),
    queryKey: sessionId ? queryKeys.live.detail(sessionId) : queryKeys.live.details(),
    queryFn: ({ signal }) => {
      if (!sessionId) {
        throw new Error('Cannot fetch live session detail without a session id')
      }

      return getLiveSession(sessionId, {}, signal)
    },
  })

  return {
    session: liveDetailQuery.data ?? null,
    isLoading: liveDetailQuery.isPending && Boolean(sessionId),
    error: liveDetailQuery.error ? toAppError(liveDetailQuery.error) : null,
    refresh: async () => {
      if (!sessionId) {
        return
      }

      await liveDetailQuery.refetch()
    },
  }
}
