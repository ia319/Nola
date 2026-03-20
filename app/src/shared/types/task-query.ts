import type { SortOrder, TaskSortBy, TaskStatus } from './task'

/** Unified status filter used by recent/history query controls. */
export type TaskFilterStatus = TaskStatus | 'all'

/** Shared query model for task list interactions. */
export interface TaskQueryModel {
  q: string
  status: TaskFilterStatus
  sort_by: TaskSortBy
  order: SortOrder
  page: number
  page_size: number
}
