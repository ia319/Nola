import { useCallback, useMemo, useState } from 'react'

import { RECENT_PAGE_SIZE } from '@/config/constants'
import type { TaskFilterStatus, TaskQueryModel, TaskSortBy, TaskSummary } from '@/shared/types'

export interface UseRecentTaskQueryResult {
  query: TaskQueryModel
  tasks: TaskSummary[]
  total: number
  setSearch: (value: string) => void
  setStatus: (value: TaskFilterStatus) => void
  setSortBy: (value: TaskSortBy) => void
  setOrder: (value: TaskQueryModel['order']) => void
  setPage: (value: number) => void
}

function toTimestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function compareBySortField(a: TaskSummary, b: TaskSummary, sortBy: TaskSortBy): number {
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
  sortBy: TaskSortBy,
  order: TaskQueryModel['order'],
): number {
  const primary = compareBySortField(a, b, sortBy)
  if (primary !== 0) {
    return order === 'asc' ? primary : -primary
  }

  const createdDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at)
  if (createdDiff !== 0) return createdDiff
  return b.task_id.localeCompare(a.task_id)
}

function includeByKeyword(task: TaskSummary, keyword: string): boolean {
  if (!keyword) return true
  const normalized = keyword.toLowerCase()
  return (
    task.task_id.toLowerCase().includes(normalized) ||
    task.file_id.toLowerCase().includes(normalized) ||
    (task.filename ?? '').toLowerCase().includes(normalized)
  )
}

/**
 * Keep recent-task query behavior local and deterministic for in-memory data.
 */
export function useRecentTaskQuery(
  sourceTasks: TaskSummary[],
  pageSize: number = RECENT_PAGE_SIZE,
): UseRecentTaskQueryResult {
  const [query, setQuery] = useState<TaskQueryModel>({
    q: '',
    status: 'all',
    sort_by: 'created_at',
    order: 'desc',
    page: 1,
    page_size: pageSize,
  })

  const filteredTasks = useMemo(() => {
    const keyword = query.q.trim()
    return sourceTasks
      .filter((task) => {
        if (query.status !== 'all' && task.status !== query.status) {
          return false
        }
        return includeByKeyword(task, keyword)
      })
      .slice()
      .sort((a, b) => compareTasks(a, b, query.sort_by, query.order))
  }, [query.order, query.q, query.sort_by, query.status, sourceTasks])

  const total = filteredTasks.length
  const totalPages = Math.max(1, Math.ceil(total / Math.max(query.page_size, 1)))
  const currentPage = Math.min(query.page, totalPages)

  const tasks = useMemo(() => {
    const offset = (currentPage - 1) * query.page_size
    return filteredTasks.slice(offset, offset + query.page_size)
  }, [currentPage, filteredTasks, query.page_size])

  const setSearch = useCallback((value: string) => {
    setQuery((previous) => ({
      ...previous,
      q: value,
      page: 1,
    }))
  }, [])

  const setStatus = useCallback((value: TaskFilterStatus) => {
    setQuery((previous) => ({
      ...previous,
      status: value,
      page: 1,
    }))
  }, [])

  const setSortBy = useCallback((value: TaskSortBy) => {
    setQuery((previous) => ({
      ...previous,
      sort_by: value,
      page: 1,
    }))
  }, [])

  const setOrder = useCallback((value: TaskQueryModel['order']) => {
    setQuery((previous) => ({
      ...previous,
      order: value,
      page: 1,
    }))
  }, [])

  const setPage = useCallback((value: number) => {
    setQuery((previous) => ({
      ...previous,
      page: Math.max(1, value),
    }))
  }, [])

  return {
    query: {
      ...query,
      page: currentPage,
    },
    tasks,
    total,
    setSearch,
    setStatus,
    setSortBy,
    setOrder,
    setPage,
  }
}
