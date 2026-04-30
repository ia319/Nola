import { useQuery } from '@tanstack/react-query'

import { getTask } from '@/features/tasks/api'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type { AppError, TaskDetail } from '@/shared/types'

export interface UseTaskDetailResult {
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

/**
 * Load one task detail record when a row detail surface is open.
 */
export function useTaskDetail(taskId: string | null): UseTaskDetailResult {
  const taskDetailQuery = useQuery({
    queryKey: taskId ? queryKeys.tasks.detail(taskId) : [...queryKeys.tasks.details(), 'idle'],
    queryFn: ({ signal }) => {
      if (!taskId) {
        throw new Error('useTaskDetail requires a task id')
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
      if (!taskId) {
        return
      }
      await taskDetailQuery.refetch()
    },
  }
}
