// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLocalInteractiveTableQuery } from '../hooks/useLocalInteractiveTableQuery'

type Row = {
  id: string
  name: string
  kind: 'audio' | 'video'
  size: number
}

const rows: Row[] = [
  { id: 'row-1', name: 'Alpha interview', kind: 'audio', size: 4 },
  { id: 'row-2', name: 'Beta demo', kind: 'video', size: 2 },
  { id: 'row-3', name: 'Alpha meeting', kind: 'audio', size: 8 },
  { id: 'row-4', name: 'Alpha notes', kind: 'audio', size: 8 },
]

describe('useLocalInteractiveTableQuery', () => {
  it('applies search, active filters, sorting, and pagination to a complete local set', () => {
    const { result } = renderHook(() =>
      useLocalInteractiveTableQuery<Row, 'size'>({
        rows,
        search: {
          query: ' alpha ',
          getText: (row) => row.name,
        },
        filters: [
          {
            id: 'audio-only',
            predicate: (row) => row.kind === 'audio',
          },
          {
            id: 'inactive',
            active: false,
            predicate: () => false,
          },
        ],
        sort: { key: 'size', direction: 'desc' },
        sortComparators: {
          size: (left, right) => left.size - right.size,
        },
        pagination: {
          page: 1,
          pageSize: 2,
        },
      }),
    )

    expect(result.current.totalRowCount).toBe(4)
    expect(result.current.filteredRowCount).toBe(3)
    expect(result.current.sortedRows.map((row) => row.id)).toEqual(['row-3', 'row-4', 'row-1'])
    expect(result.current.pageRows.map((row) => row.id)).toEqual(['row-3', 'row-4'])
    expect(result.current.pageCount).toBe(2)
  })

  it('uses the original row order as a stable tie-breaker', () => {
    const { result } = renderHook(() =>
      useLocalInteractiveTableQuery<Row, 'size'>({
        rows,
        sort: { key: 'size', direction: 'desc' },
        sortComparators: {
          size: (left, right) => left.size - right.size,
        },
      }),
    )

    expect(result.current.sortedRows.map((row) => row.id)).toEqual([
      'row-3',
      'row-4',
      'row-1',
      'row-2',
    ])
  })

  it('supports custom search predicates and clamps invalid pagination input', () => {
    const { result } = renderHook(() =>
      useLocalInteractiveTableQuery<Row, 'name'>({
        rows,
        search: {
          query: 'ROW-2',
          predicate: (row, query) => row.id.toLowerCase() === query,
        },
        sort: { key: 'name', direction: 'asc' },
        sortComparators: {
          name: (left, right) => left.name.localeCompare(right.name),
        },
        pagination: {
          page: 10,
          pageSize: 0,
        },
      }),
    )

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(1)
    expect(result.current.offset).toBe(0)
    expect(result.current.pageRows.map((row) => row.id)).toEqual(['row-2'])
  })
})
