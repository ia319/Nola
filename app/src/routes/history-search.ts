import { HISTORY_PAGE_SIZE } from '@/config/constants'
import {
  DEFAULT_FILE_CONTENT_TYPE_FILTER,
  DEFAULT_FILE_SORT_BY,
  DEFAULT_FILE_SORT_ORDER,
  FILE_ORDER_OPTIONS,
  FILE_SORT_OPTIONS,
  type FileContentTypeFilterValue,
} from '@/shared/lib/file-query-options'
import {
  DEFAULT_TASK_FILTER_STATUS,
  DEFAULT_TASK_ORDER,
  DEFAULT_TASK_SORT_BY,
  TASK_FILTER_STATUS_OPTIONS,
  TASK_ORDER_OPTIONS,
  TASK_SORT_OPTIONS,
} from '@/shared/lib/task-query-options'
import type {
  FileSortBy,
  FileSortOrder,
  SortOrder,
  TaskFilterStatus,
  TaskQueryModel,
  TaskSortBy,
} from '@/shared/types'

export const HISTORY_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

const STATUS_SET = new Set<TaskFilterStatus>(TASK_FILTER_STATUS_OPTIONS)
const SORT_SET = new Set<TaskSortBy>(TASK_SORT_OPTIONS)
const ORDER_SET = new Set<SortOrder>(TASK_ORDER_OPTIONS)
const FILE_SORT_SET = new Set<FileSortBy>(FILE_SORT_OPTIONS)
const FILE_ORDER_SET = new Set<FileSortOrder>(FILE_ORDER_OPTIONS)
const PAGE_SIZE_SET = new Set<number>(HISTORY_PAGE_SIZE_OPTIONS)

export type HistoryPageSize = (typeof HISTORY_PAGE_SIZE_OPTIONS)[number]
export type HistoryRecordsMode = 'files' | 'tasks'
export type HistoryRouteMode = HistoryRecordsMode | 'live'
export type HistoryTaskQuery = TaskQueryModel & {
  page_size: HistoryPageSize
}

const MODE_OPTIONS: readonly HistoryRouteMode[] = ['tasks', 'files', 'live']
const MODE_SET = new Set(MODE_OPTIONS)

export interface HistoryFileQuery {
  q: string
  content_type: FileContentTypeFilterValue
  sort_by: FileSortBy
  order: FileSortOrder
  page: number
  page_size: HistoryPageSize
}

export interface HistoryRouteSearch {
  mode?: HistoryRouteMode
  q?: string
  status?: TaskFilterStatus
  content_type?: FileContentTypeFilterValue
  sort_by?: TaskSortBy | FileSortBy
  order?: SortOrder | FileSortOrder
  page?: number
  page_size?: HistoryPageSize
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return undefined
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    if (value.trim() === '') return undefined
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return undefined
    return parsed
  }
  return undefined
}

function isSearchRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Normalize route search params to one canonical representation.
 *
 * Keep defaults omitted from URL so links stay compact and stable.
 */
export function normalizeHistorySearch(search: unknown): HistoryRouteSearch {
  const searchRecord = isSearchRecord(search) ? search : {}
  const modeValue = typeof searchRecord.mode === 'string' ? searchRecord.mode : ''
  const qValue = typeof searchRecord.q === 'string' ? searchRecord.q.trim() : ''
  const statusValue = typeof searchRecord.status === 'string' ? searchRecord.status : ''
  const contentTypeValue =
    typeof searchRecord.content_type === 'string' ? searchRecord.content_type.trim() : ''
  const sortByValue = typeof searchRecord.sort_by === 'string' ? searchRecord.sort_by : ''
  const orderValue = typeof searchRecord.order === 'string' ? searchRecord.order : ''
  const pageValue = parsePositiveInt(searchRecord.page)
  const pageSizeValue = parsePositiveInt(searchRecord.page_size)

  const next: HistoryRouteSearch = {}
  const normalizedMode = MODE_SET.has(modeValue as HistoryRouteMode)
    ? (modeValue as HistoryRouteMode)
    : 'tasks'

  if (normalizedMode === 'files') {
    next.mode = 'files'
    if (qValue !== '') {
      next.q = qValue
    }

    if (contentTypeValue !== '' && contentTypeValue !== DEFAULT_FILE_CONTENT_TYPE_FILTER) {
      next.content_type = contentTypeValue
    }

    if (FILE_SORT_SET.has(sortByValue as FileSortBy) && sortByValue !== DEFAULT_FILE_SORT_BY) {
      next.sort_by = sortByValue as FileSortBy
    }

    if (FILE_ORDER_SET.has(orderValue as FileSortOrder) && orderValue !== DEFAULT_FILE_SORT_ORDER) {
      next.order = orderValue as FileSortOrder
    }
  }

  if (normalizedMode === 'live') {
    next.mode = 'live'
    if (qValue !== '') {
      next.q = qValue
    }
  }

  if (normalizedMode === 'tasks') {
    if (qValue !== '') {
      next.q = qValue
    }

    if (
      STATUS_SET.has(statusValue as TaskFilterStatus) &&
      statusValue !== DEFAULT_TASK_FILTER_STATUS
    ) {
      next.status = statusValue as TaskFilterStatus
    }

    if (SORT_SET.has(sortByValue as TaskSortBy) && sortByValue !== DEFAULT_TASK_SORT_BY) {
      next.sort_by = sortByValue as TaskSortBy
    }

    if (ORDER_SET.has(orderValue as SortOrder) && orderValue !== DEFAULT_TASK_ORDER) {
      next.order = orderValue as SortOrder
    }
  }

  if (typeof pageValue !== 'undefined' && pageValue > 1) {
    next.page = pageValue
  }

  if (
    typeof pageSizeValue !== 'undefined' &&
    PAGE_SIZE_SET.has(pageSizeValue) &&
    pageSizeValue !== HISTORY_PAGE_SIZE
  ) {
    next.page_size = pageSizeValue as HistoryPageSize
  }

  return next
}

/** Convert normalized route search params into backend query model. */
export function buildHistoryTaskQuery(search: HistoryRouteSearch): HistoryTaskQuery {
  const isTaskMode = search.mode !== 'files' && search.mode !== 'live'
  return {
    q: isTaskMode ? (search.q ?? '') : '',
    status: isTaskMode ? (search.status ?? DEFAULT_TASK_FILTER_STATUS) : DEFAULT_TASK_FILTER_STATUS,
    sort_by:
      isTaskMode && SORT_SET.has(search.sort_by as TaskSortBy)
        ? (search.sort_by as TaskSortBy)
        : DEFAULT_TASK_SORT_BY,
    order:
      isTaskMode && ORDER_SET.has(search.order as SortOrder)
        ? (search.order as SortOrder)
        : DEFAULT_TASK_ORDER,
    page: search.page ?? 1,
    page_size: search.page_size ?? HISTORY_PAGE_SIZE,
  }
}

/** Convert normalized route search params into filename-mode query model. */
export function buildHistoryFileQuery(search: HistoryRouteSearch): HistoryFileQuery {
  const isFileMode = search.mode === 'files'
  return {
    q: isFileMode ? (search.q ?? '') : '',
    content_type: isFileMode
      ? (search.content_type ?? DEFAULT_FILE_CONTENT_TYPE_FILTER)
      : DEFAULT_FILE_CONTENT_TYPE_FILTER,
    sort_by:
      isFileMode && FILE_SORT_SET.has(search.sort_by as FileSortBy)
        ? (search.sort_by as FileSortBy)
        : DEFAULT_FILE_SORT_BY,
    order:
      isFileMode && FILE_ORDER_SET.has(search.order as FileSortOrder)
        ? (search.order as FileSortOrder)
        : DEFAULT_FILE_SORT_ORDER,
    page: search.page ?? 1,
    page_size: search.page_size ?? HISTORY_PAGE_SIZE,
  }
}

/** Check whether two normalized search models are equivalent. */
export function isSameHistorySearch(a: HistoryRouteSearch, b: HistoryRouteSearch): boolean {
  return (
    a.mode === b.mode &&
    a.q === b.q &&
    a.status === b.status &&
    a.content_type === b.content_type &&
    a.sort_by === b.sort_by &&
    a.order === b.order &&
    a.page === b.page &&
    a.page_size === b.page_size
  )
}
