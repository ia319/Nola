import { useQuery } from '@tanstack/react-query'

import { getTask } from '@/features/tasks'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type { AppError, TaskDetail } from '@/shared/types'

export interface UseHistoryTaskDetailResult {
  task: TaskDetail | null
  isLoading: boolean
  error: AppError | null
  refresh: () => Promise<void>
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error
  }

  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

export function useHistoryTaskDetail(taskId: string | null): UseHistoryTaskDetailResult {
  const taskDetailQuery = useQuery({
    queryKey: taskId ? queryKeys.tasks.detail(taskId) : [...queryKeys.tasks.details(), 'idle'],
    queryFn: ({ signal }) => {
      if (!taskId) {
        throw new Error('useHistoryTaskDetail requires a task id')
      }

      return getTask(taskId, signal)
    },
    enabled: taskId !== null,
  })

  return {
    task: taskDetailQuery.data ?? null,
    isLoading: taskDetailQuery.isPending,
    error: taskDetailQuery.error ? toAppError(taskDetailQuery.error) : null,
    refresh: async () => {
      await taskDetailQuery.refetch()
    },
  }
}
