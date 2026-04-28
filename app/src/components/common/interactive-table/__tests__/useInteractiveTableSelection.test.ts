// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useInteractiveTableSelection } from '../hooks/useInteractiveTableSelection'

type Row = {
  id: string
  status: 'ready' | 'locked'
}

function buildRow(id: string, status: Row['status'] = 'ready'): Row {
  return { id, status }
}

describe('useInteractiveTableSelection', () => {
  it('selects one row, selects the current page, and clears selection', () => {
    const rows = [buildRow('row-1'), buildRow('row-2')]
    const { result } = renderHook(() =>
      useInteractiveTableSelection({
        rows,
        getRowId: (row) => row.id,
      }),
    )

    act(() => {
      result.current.onToggleRow(rows[0], true)
    })
    expect(result.current.selectedRowIds).toEqual(['row-1'])
    expect(result.current.hasCurrentPageSelection).toBe(true)

    act(() => {
      result.current.onToggleCurrentPage(true, rows)
    })
    expect(result.current.allCurrentPageSelected).toBe(true)
    expect(result.current.selectedRowIds).toEqual(['row-1', 'row-2'])

    act(() => {
      result.current.onClearSelection()
    })
    expect(result.current.selectedRowIds).toEqual([])
  })

  it('resets selection when resetToken changes', () => {
    const rows = [buildRow('row-1')]
    const { result, rerender } = renderHook(
      ({ token }) =>
        useInteractiveTableSelection({
          rows,
          getRowId: (row) => row.id,
          resetToken: token,
        }),
      {
        initialProps: { token: 'a' },
      },
    )

    act(() => {
      result.current.onToggleRow(rows[0], true)
    })
    expect(result.current.selectedRowIds).toEqual(['row-1'])

    rerender({ token: 'b' })
    expect(result.current.selectedRowIds).toEqual([])
  })

  it('excludes unselectable rows from row and current-page selection', () => {
    const rows = [buildRow('row-1'), buildRow('row-2', 'locked'), buildRow('row-3')]
    const { result } = renderHook(() =>
      useInteractiveTableSelection({
        rows,
        getRowId: (row) => row.id,
        getRowSelectable: (row) => row.status !== 'locked',
      }),
    )

    act(() => {
      result.current.onToggleRow(rows[1], true)
    })
    expect(result.current.selectedRowIds).toEqual([])

    act(() => {
      result.current.onToggleCurrentPage(true, rows)
    })
    expect(result.current.selectableRows).toEqual([rows[0], rows[2]])
    expect(result.current.selectedRowIds).toEqual(['row-1', 'row-3'])
    expect(result.current.selectedRows).toEqual([rows[0], rows[2]])
  })
})
