import { HISTORY_PAGE_SIZE } from '@/config/constants'
import type { SortOrder, TaskFilterStatus, TaskQueryModel, TaskSortBy } from '@/shared/types'

const STATUS_OPTIONS: TaskFilterStatus[] = [
  'all',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]

const SORT_OPTIONS: TaskSortBy[] = ['created_at', 'completed_at', 'status', 'progress', 'filename']
const ORDER_OPTIONS: SortOrder[] = ['desc', 'asc']
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const

const STATUS_SET = new Set(STATUS_OPTIONS)
const SORT_SET = new Set(SORT_OPTIONS)
const ORDER_SET = new Set(ORDER_OPTIONS)
const PAGE_SIZE_SET = new Set<number>(PAGE_SIZE_OPTIONS)

export type HistoryPageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export interface HistoryRouteSearch {
  q?: string
  status?: TaskFilterStatus
  sort_by?: TaskSortBy
  order?: SortOrder
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

/**
 * Normalize route search params to one canonical representation.
 *
 * Keep defaults omitted from URL so links stay compact and stable.
 */
export function normalizeHistorySearch(search: Record<string, unknown>): HistoryRouteSearch {
  const qValue = typeof search.q === 'string' ? search.q.trim() : ''
  const statusValue = typeof search.status === 'string' ? search.status : ''
  const sortByValue = typeof search.sort_by === 'string' ? search.sort_by : ''
  const orderValue = typeof search.order === 'string' ? search.order : ''
  const pageValue = parsePositiveInt(search.page)
  const pageSizeValue = parsePositiveInt(search.page_size)

  const next: HistoryRouteSearch = {}

  if (qValue !== '') {
    next.q = qValue
  }

  if (STATUS_SET.has(statusValue as TaskFilterStatus) && statusValue !== 'all') {
    next.status = statusValue as TaskFilterStatus
  }

  if (SORT_SET.has(sortByValue as TaskSortBy) && sortByValue !== 'created_at') {
    next.sort_by = sortByValue as TaskSortBy
  }

  if (ORDER_SET.has(orderValue as SortOrder) && orderValue !== 'desc') {
    next.order = orderValue as SortOrder
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
export function buildHistoryQuery(search: HistoryRouteSearch): TaskQueryModel {
  return {
    q: search.q ?? '',
    status: search.status ?? 'all',
    sort_by: search.sort_by ?? 'created_at',
    order: search.order ?? 'desc',
    page: search.page ?? 1,
    page_size: search.page_size ?? HISTORY_PAGE_SIZE,
  }
}

/** Check whether two normalized search models are equivalent. */
export function isSameHistorySearch(a: HistoryRouteSearch, b: HistoryRouteSearch): boolean {
  return (
    a.q === b.q &&
    a.status === b.status &&
    a.sort_by === b.sort_by &&
    a.order === b.order &&
    a.page === b.page &&
    a.page_size === b.page_size
  )
}
