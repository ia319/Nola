import { useCallback, useMemo, useState } from 'react'

import type { InteractiveTableSelection } from '../types'

export interface UseInteractiveTableSelectionOptions<Row> {
  rows: readonly Row[]
  getRowId: (row: Row) => string
  getRowSelectable?: (row: Row) => boolean
  resetToken?: string
  initialSelectedRowIds?: readonly string[]
}

export interface UseInteractiveTableSelectionResult<Row> {
  selectedRowIds: string[]
  selectedRowIdSet: ReadonlySet<string>
  selectedRows: readonly Row[]
  selectableRows: readonly Row[]
  allCurrentPageSelected: boolean
  hasCurrentPageSelection: boolean
  onToggleRow: InteractiveTableSelection<Row>['onToggleRow']
  onToggleCurrentPage: InteractiveTableSelection<Row>['onToggleCurrentPage']
  onClearSelection: InteractiveTableSelection<Row>['onClearSelection']
  selection: Pick<
    InteractiveTableSelection<Row>,
    | 'selectedRowIds'
    | 'onToggleRow'
    | 'onToggleCurrentPage'
    | 'onClearSelection'
    | 'getRowSelectable'
  >
}

type SelectionState = {
  resetToken: string | undefined
  ids: string[]
}

function uniqueIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids))
}

/**
 * Manage current-page table selection with optional row eligibility.
 */
export function useInteractiveTableSelection<Row>({
  rows,
  getRowId,
  getRowSelectable,
  resetToken,
  initialSelectedRowIds = [],
}: UseInteractiveTableSelectionOptions<Row>): UseInteractiveTableSelectionResult<Row> {
  const [selectionState, setSelectionState] = useState<SelectionState>(() => ({
    resetToken,
    ids: uniqueIds(initialSelectedRowIds),
  }))

  const selectableRows = useMemo(() => {
    return rows.filter((row) => getRowSelectable?.(row) ?? true)
  }, [getRowSelectable, rows])

  const selectableRowIds = useMemo(() => {
    return selectableRows.map((row) => getRowId(row))
  }, [getRowId, selectableRows])

  const selectableRowIdSet = useMemo(() => {
    return new Set(selectableRowIds)
  }, [selectableRowIds])

  const rawSelectedRowIds = useMemo(() => {
    return selectionState.resetToken === resetToken ? selectionState.ids : []
  }, [resetToken, selectionState.ids, selectionState.resetToken])

  const selectedRowIds = useMemo(() => {
    return rawSelectedRowIds.filter((rowId) => selectableRowIdSet.has(rowId))
  }, [rawSelectedRowIds, selectableRowIdSet])

  const selectedRowIdSet = useMemo(() => {
    return new Set(selectedRowIds)
  }, [selectedRowIds])

  const selectedRows = useMemo(() => {
    return selectableRows.filter((row) => selectedRowIdSet.has(getRowId(row)))
  }, [getRowId, selectableRows, selectedRowIdSet])

  const allCurrentPageSelected =
    selectableRowIds.length > 0 && selectableRowIds.every((rowId) => selectedRowIdSet.has(rowId))

  const getScopedSelectedIds = useCallback(
    (previous: SelectionState): string[] => {
      const previousIds = previous.resetToken === resetToken ? previous.ids : []
      return previousIds.filter((rowId) => selectableRowIdSet.has(rowId))
    },
    [resetToken, selectableRowIdSet],
  )

  const onToggleRow = useCallback<InteractiveTableSelection<Row>['onToggleRow']>(
    (row, checked) => {
      const rowId = getRowId(row)
      const selectable = getRowSelectable?.(row) ?? true

      if (checked && !selectable) {
        return
      }

      setSelectionState((previous) => {
        const scopedIds = getScopedSelectedIds(previous)

        if (!checked) {
          return {
            resetToken,
            ids: scopedIds.filter((value) => value !== rowId),
          }
        }

        if (scopedIds.includes(rowId)) {
          return {
            resetToken,
            ids: scopedIds,
          }
        }

        return {
          resetToken,
          ids: [...scopedIds, rowId],
        }
      })
    },
    [getRowId, getRowSelectable, getScopedSelectedIds, resetToken],
  )

  const onToggleCurrentPage = useCallback<InteractiveTableSelection<Row>['onToggleCurrentPage']>(
    (checked, targetRows) => {
      const targetRowIds = targetRows
        .filter((row) => getRowSelectable?.(row) ?? true)
        .map((row) => getRowId(row))

      setSelectionState((previous) => {
        const scopedIds = getScopedSelectedIds(previous)

        if (!checked) {
          const targetRowIdSet = new Set(targetRowIds)
          return {
            resetToken,
            ids: scopedIds.filter((rowId) => !targetRowIdSet.has(rowId)),
          }
        }

        const next = new Set(scopedIds)
        for (const rowId of targetRowIds) {
          next.add(rowId)
        }

        return {
          resetToken,
          ids: Array.from(next),
        }
      })
    },
    [getRowId, getRowSelectable, getScopedSelectedIds, resetToken],
  )

  const onClearSelection = useCallback(() => {
    setSelectionState({
      resetToken,
      ids: [],
    })
  }, [resetToken])

  const selection = useMemo<UseInteractiveTableSelectionResult<Row>['selection']>(
    () => ({
      selectedRowIds,
      onToggleRow,
      onToggleCurrentPage,
      onClearSelection,
      getRowSelectable,
    }),
    [getRowSelectable, onClearSelection, onToggleCurrentPage, onToggleRow, selectedRowIds],
  )

  return {
    selectedRowIds,
    selectedRowIdSet,
    selectedRows,
    selectableRows,
    allCurrentPageSelected,
    hasCurrentPageSelection: selectedRowIds.length > 0,
    onToggleRow,
    onToggleCurrentPage,
    onClearSelection,
    selection,
  }
}
