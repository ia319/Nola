import type { LiveSessionStatus } from '@/shared/types'

export type LiveSessionFilterStatus = 'all' | LiveSessionStatus
export type LiveHistorySortBy = 'ended_at' | 'started_at' | 'status' | 'title'
export type LiveHistorySortOrder = 'asc' | 'desc'

export const DEFAULT_LIVE_FILTER_STATUS = 'all' satisfies LiveSessionFilterStatus
export const DEFAULT_LIVE_SORT_BY = 'started_at' satisfies LiveHistorySortBy
export const DEFAULT_LIVE_SORT_ORDER = 'desc' satisfies LiveHistorySortOrder

const LIVE_SORT_OPTION_FLAGS: Record<LiveHistorySortBy, true> = {
  ended_at: true,
  started_at: true,
  status: true,
  title: true,
}

const LIVE_ORDER_OPTION_FLAGS: Record<LiveHistorySortOrder, true> = {
  asc: true,
  desc: true,
}

export const LIVE_FILTER_STATUS_OPTIONS = [
  DEFAULT_LIVE_FILTER_STATUS,
  'active',
  'finished',
  'failed',
] as const satisfies readonly LiveSessionFilterStatus[]

export const LIVE_SORT_OPTIONS = Object.keys(LIVE_SORT_OPTION_FLAGS) as readonly LiveHistorySortBy[]

export const LIVE_ORDER_OPTIONS = Object.keys(
  LIVE_ORDER_OPTION_FLAGS,
) as readonly LiveHistorySortOrder[]
