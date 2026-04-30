import type { SortOrder, TaskFilterStatus, TaskSortBy } from '@/shared/types'
import { TASK_STATUS_OPTIONS } from './task-status'

export const DEFAULT_TASK_FILTER_STATUS = 'all' satisfies TaskFilterStatus
export const DEFAULT_TASK_SORT_BY = 'created_at' satisfies TaskSortBy
export const DEFAULT_TASK_ORDER = 'desc' satisfies SortOrder

const TASK_SORT_OPTION_FLAGS: Record<TaskSortBy, true> = {
  created_at: true,
  completed_at: true,
  status: true,
  progress: true,
  filename: true,
  task_id: true,
  duration: true,
}

const TASK_ORDER_OPTION_FLAGS: Record<SortOrder, true> = {
  desc: true,
  asc: true,
}

export const TASK_FILTER_STATUS_OPTIONS = [
  DEFAULT_TASK_FILTER_STATUS,
  ...TASK_STATUS_OPTIONS,
] as const satisfies readonly TaskFilterStatus[]

export const TASK_SORT_OPTIONS = Object.keys(TASK_SORT_OPTION_FLAGS) as readonly TaskSortBy[]

export const TASK_ORDER_OPTIONS = Object.keys(TASK_ORDER_OPTION_FLAGS) as readonly SortOrder[]
