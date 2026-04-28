import { useMemo } from 'react'

import type { InteractiveSortState } from '../types'

export type LocalInteractiveTableSortComparator<Row> = (left: Row, right: Row) => number

export interface LocalInteractiveTableFilter<Row> {
  id: string
  active?: boolean
  predicate: (row: Row) => boolean
}

export type LocalInteractiveTableSearch<Row> =
  | {
      query: string
      getText: (row: Row) => string
      predicate?: never
    }
  | {
      query: string
      predicate: (row: Row, normalizedQuery: string, rawQuery: string) => boolean
      getText?: never
    }

export interface LocalInteractiveTablePagination {
  page: number
  pageSize: number
}

export interface UseLocalInteractiveTableQueryOptions<Row, SortKey extends string> {
  rows: readonly Row[]
  search?: LocalInteractiveTableSearch<Row>
  filters?: readonly LocalInteractiveTableFilter<Row>[]
  sort?: InteractiveSortState<SortKey> | null
  sortComparators?: Partial<Record<SortKey, LocalInteractiveTableSortComparator<Row>>>
  pagination?: LocalInteractiveTablePagination
}

export interface UseLocalInteractiveTableQueryResult<Row> {
  filteredRows: readonly Row[]
  sortedRows: readonly Row[]
  pageRows: readonly Row[]
  totalRowCount: number
  filteredRowCount: number
  page: number
  pageSize: number
  pageCount: number
  offset: number
}

type IndexedRow<Row> = {
  row: Row
  index: number
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

function resolvePageSize(pageSize: number): number {
  return Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 1
}

function resolvePage(page: number, pageCount: number): number {
  const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  return Math.min(normalizedPage, pageCount)
}

function matchesSearch<Row>(row: Row, search: LocalInteractiveTableSearch<Row>): boolean {
  const normalizedQuery = normalizeSearchQuery(search.query)

  if (!normalizedQuery) {
    return true
  }

  if (search.predicate) {
    return search.predicate(row, normalizedQuery, search.query)
  }

  return search.getText(row).toLowerCase().includes(normalizedQuery)
}

/**
 * Query a browser-held complete row set with stable local sorting and pagination.
 */
export function useLocalInteractiveTableQuery<Row, SortKey extends string = string>({
  rows,
  search,
  filters = [],
  sort,
  sortComparators,
  pagination,
}: UseLocalInteractiveTableQueryOptions<Row, SortKey>): UseLocalInteractiveTableQueryResult<Row> {
  const indexedRows = useMemo<readonly IndexedRow<Row>[]>(() => {
    return rows.map((row, index) => ({ row, index }))
  }, [rows])

  const filteredIndexedRows = useMemo(() => {
    return indexedRows.filter(({ row }) => {
      if (search && !matchesSearch(row, search)) {
        return false
      }

      return filters.every((filter) => {
        if (filter.active === false) {
          return true
        }
        return filter.predicate(row)
      })
    })
  }, [filters, indexedRows, search])

  const sortedIndexedRows = useMemo(() => {
    if (!sort) {
      return filteredIndexedRows
    }

    const comparator = sortComparators?.[sort.key]
    if (!comparator) {
      return filteredIndexedRows
    }

    return [...filteredIndexedRows].sort((left, right) => {
      const compared = comparator(left.row, right.row)
      if (compared !== 0) {
        return sort.direction === 'asc' ? compared : -compared
      }

      return left.index - right.index
    })
  }, [filteredIndexedRows, sort, sortComparators])

  const sortedRows = useMemo(() => {
    return sortedIndexedRows.map(({ row }) => row)
  }, [sortedIndexedRows])

  const filteredRows = useMemo(() => {
    return filteredIndexedRows.map(({ row }) => row)
  }, [filteredIndexedRows])

  const resolvedPageSize = pagination
    ? resolvePageSize(pagination.pageSize)
    : sortedRows.length || 1
  const pageCount = pagination ? Math.max(1, Math.ceil(sortedRows.length / resolvedPageSize)) : 1
  const page = pagination ? resolvePage(pagination.page, pageCount) : 1
  const offset = pagination ? (page - 1) * resolvedPageSize : 0
  const pageRows = pagination ? sortedRows.slice(offset, offset + resolvedPageSize) : sortedRows

  return {
    filteredRows,
    sortedRows,
    pageRows,
    totalRowCount: rows.length,
    filteredRowCount: filteredRows.length,
    page,
    pageSize: resolvedPageSize,
    pageCount,
    offset,
  }
}
