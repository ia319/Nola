import type { SortOrder, TaskFilterStatus, TaskSortBy } from '@/shared/types'
import { TASK_STATUS_OPTIONS } from './task-status'

export const DEFAULT_TASK_FILTER_STATUS = 'all' satisfies TaskFilterStatus
export const DEFAULT_TASK_SORT_BY = 'created_at' satisfies TaskSortBy
export const DEFAULT_TASK_ORDER = 'desc' satisfies SortOrder

export const TASK_FILTER_STATUS_OPTIONS = [
  DEFAULT_TASK_FILTER_STATUS,
  ...TASK_STATUS_OPTIONS,
] as const satisfies readonly TaskFilterStatus[]

export const TASK_SORT_OPTIONS = [
  'created_at',
  'completed_at',
  'status',
  'progress',
  'filename',
] as const satisfies readonly TaskSortBy[]

export const TASK_ORDER_OPTIONS = [
  DEFAULT_TASK_ORDER,
  'asc',
] as const satisfies readonly SortOrder[]
