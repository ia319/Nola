import apiClient from '@/shared/lib/api-client'
import type { SortOrder, TaskListResponse, TaskSortBy, TaskStatus } from '@/shared/types'

const BASE = '/api/transcription-tasks'

/** List history tasks through backend pagination/filter APIs. */
export async function listHistoryTasks(
  params: {
    status?: TaskStatus
    q?: string
    sort_by?: TaskSortBy
    order?: SortOrder
    limit?: number
    offset?: number
  } = {},
  signal?: AbortSignal,
): Promise<TaskListResponse> {
  const { data } = await apiClient.get<TaskListResponse>(BASE + '/', {
    params,
    signal,
  })
  return data
}
