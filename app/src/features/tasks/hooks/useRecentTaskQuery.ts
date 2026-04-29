import { useCallback, useMemo, useState } from 'react'

import { RECENT_PAGE_SIZE } from '@/config/constants'
import {
  DEFAULT_TASK_FILTER_STATUS,
  DEFAULT_TASK_ORDER,
  DEFAULT_TASK_SORT_BY,
} from '@/shared/lib/task-query-options'
import type { SortOrder, TaskFilterStatus, TaskSortBy, TaskSummary } from '@/shared/types'

export type RecentTaskSortBy = Exclude<TaskSortBy, 'duration'>

export interface RecentTaskQueryModel {
  q: string
  status: TaskFilterStatus
  sort_by: RecentTaskSortBy
  order: SortOrder
  page: number
  page_size: number
}

export interface UseRecentTaskQueryResult {
  query: RecentTaskQueryModel
  tasks: TaskSummary[]
  total: number
  totalPages: number
  newTaskCount: number
  setSearch: (value: string) => void
  setStatus: (value: TaskFilterStatus) => void
  setSortBy: (value: RecentTaskSortBy) => void
  setOrder: (value: RecentTaskQueryModel['order']) => void
  setPage: (value: number) => void
  goToFirstPageForNewTasks: () => void
}

export interface UseRecentTaskQueryOptions {
  getFileLabel?: (task: TaskSummary) => string
}

function toTimestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function getDefaultFileLabel(task: TaskSummary): string {
  return task.filename?.trim() || task.file_id
}

function compareBySortField(
  a: TaskSummary,
  b: TaskSummary,
  sortBy: RecentTaskSortBy,
  getFileLabel: (task: TaskSummary) => string,
): number {
  if (sortBy === 'task_id') {
    return a.task_id.localeCompare(b.task_id)
  }
  if (sortBy === 'filename') {
    return getFileLabel(a).localeCompare(getFileLabel(b))
  }
  if (sortBy === 'created_at') {
    return toTimestamp(a.created_at) - toTimestamp(b.created_at)
  }
  if (sortBy === 'completed_at') {
    return toTimestamp(a.completed_at) - toTimestamp(b.completed_at)
  }
  if (sortBy === 'progress') {
    return a.progress - b.progress
  }
  return a.status.localeCompare(b.status)
}

function compareTasks(
  a: TaskSummary,
  b: TaskSummary,
  sortBy: RecentTaskSortBy,
  order: RecentTaskQueryModel['order'],
  getFileLabel: (task: TaskSummary) => string,
): number {
  const primary = compareBySortField(a, b, sortBy, getFileLabel)
  if (primary !== 0) {
    return order === 'asc' ? primary : -primary
  }

  const createdDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at)
  if (createdDiff !== 0) return createdDiff
  return b.task_id.localeCompare(a.task_id)
}

function includeByKeyword(
  task: TaskSummary,
  keyword: string,
  getFileLabel: (task: TaskSummary) => string,
): boolean {
  if (!keyword) return true
  const normalized = keyword.toLowerCase()
  return (
    task.task_id.toLowerCase().includes(normalized) ||
    task.file_id.toLowerCase().includes(normalized) ||
    getFileLabel(task).toLowerCase().includes(normalized)
  )
}

export function useRecentTaskQuery(
  sourceTasks: TaskSummary[],
  pageSize: number = RECENT_PAGE_SIZE,
  options: UseRecentTaskQueryOptions = {},
): UseRecentTaskQueryResult {
  const [query, setQuery] = useState<RecentTaskQueryModel>({
    q: '',
    status: DEFAULT_TASK_FILTER_STATUS,
    sort_by: DEFAULT_TASK_SORT_BY,
    order: DEFAULT_TASK_ORDER,
    page: 1,
    page_size: pageSize,
  })

  const filteredTasks = useMemo(() => {
    const keyword = query.q.trim()
    const getFileLabel = options.getFileLabel ?? getDefaultFileLabel
    return sourceTasks
      .filter((task) => {
        if (query.status !== DEFAULT_TASK_FILTER_STATUS && task.status !== query.status) {
          return false
        }
        return includeByKeyword(task, keyword, getFileLabel)
      })
      .slice()
      .sort((a, b) => compareTasks(a, b, query.sort_by, query.order, getFileLabel))
  }, [options.getFileLabel, query.order, query.q, query.sort_by, query.status, sourceTasks])

  const total = filteredTasks.length
  const totalPages = Math.max(1, Math.ceil(total / Math.max(query.page_size, 1)))
  const currentPage = Math.min(query.page, totalPages)
  const [acknowledgedTotal, setAcknowledgedTotal] = useState(total)

  const tasks = useMemo(() => {
    const offset = (currentPage - 1) * query.page_size
    return filteredTasks.slice(offset, offset + query.page_size)
  }, [currentPage, filteredTasks, query.page_size])

  const newTaskCount = currentPage > 1 ? Math.max(0, total - acknowledgedTotal) : 0

  const setSearch = useCallback(
    (value: string) => {
      setAcknowledgedTotal(total)
      setQuery((previous) => ({
        ...previous,
        q: value,
        page: 1,
      }))
    },
    [total],
  )

  const setStatus = useCallback(
    (value: TaskFilterStatus) => {
      setAcknowledgedTotal(total)
      setQuery((previous) => ({
        ...previous,
        status: value,
        page: 1,
      }))
    },
    [total],
  )

  const setSortBy = useCallback(
    (value: RecentTaskSortBy) => {
      setAcknowledgedTotal(total)
      setQuery((previous) => ({
        ...previous,
        sort_by: value,
        page: 1,
      }))
    },
    [total],
  )

  const setOrder = useCallback(
    (value: RecentTaskQueryModel['order']) => {
      setAcknowledgedTotal(total)
      setQuery((previous) => ({
        ...previous,
        order: value,
        page: 1,
      }))
    },
    [total],
  )

  const setPage = useCallback(
    (value: number) => {
      const safePage = Math.max(1, value)
      if ((currentPage === 1 && safePage > 1) || safePage === 1) {
        setAcknowledgedTotal(total)
      }
      setQuery((previous) => ({
        ...previous,
        page: safePage,
      }))
    },
    [currentPage, total],
  )

  const goToFirstPageForNewTasks = useCallback(() => {
    setAcknowledgedTotal(total)
    setQuery((previous) => ({
      ...previous,
      page: 1,
    }))
  }, [total])

  return {
    query: {
      ...query,
      page: currentPage,
    },
    tasks,
    total,
    totalPages,
    newTaskCount,
    setSearch,
    setStatus,
    setSortBy,
    setOrder,
    setPage,
    goToFirstPageForNewTasks,
  }
}
