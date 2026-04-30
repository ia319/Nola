import { type ComponentPropsWithoutRef, type ReactNode, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable, type DataTableColumn, type DataTableProps } from '@/components/ui/DataTable'
import { cn } from '@/lib/utils'
import { InteractiveTableBatchActionBar } from './InteractiveTableBatchActionBar'
import { InteractiveTableSortableHeader } from './InteractiveTableSortableHeader'
import type {
  InteractiveBatchAction,
  InteractiveSortState,
  InteractiveTableColumn,
  InteractiveTableSelection,
} from './types'

const SELECTION_COLUMN_ID = '__interactive-table-selection__'

export type InteractiveTableProps<Row, SortKey extends string = string> = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  columns: readonly InteractiveTableColumn<Row, SortKey>[]
  rows: readonly Row[]
  getRowId: (row: Row) => string
  caption?: string
  sort?: InteractiveSortState<SortKey> | null
  onSortChange?: (sort: InteractiveSortState<SortKey>) => void
  selection?: InteractiveTableSelection<Row>
  batchActions?: readonly InteractiveBatchAction<Row>[]
  filters?: ReactNode
  pagination?: ReactNode
  emptyState?: DataTableProps<Row>['emptyState']
  errorState?: DataTableProps<Row>['errorState']
  isLoading?: boolean
  loadingRowCount?: number
  loadingState?: ReactNode
  onRowClick?: (row: Row) => void
  rowClassName?: DataTableProps<Row>['rowClassName']
  scrollAreaClassName?: string
  stickyHeader?: boolean
  tableClassName?: string
}

type SelectAllCheckboxProps<Row> = {
  label: string
  rows: readonly Row[]
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  onToggle: (checked: boolean, rows: readonly Row[]) => void
}

function SelectAllCheckbox<Row>({
  label,
  rows,
  checked,
  indeterminate,
  disabled,
  onToggle,
}: SelectAllCheckboxProps<Row>) {
  const checkboxRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!checkboxRef.current) return
    checkboxRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      className="border-border h-4 w-4 rounded"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(event) => {
        if (disabled) return
        onToggle(event.target.checked, rows)
      }}
    />
  )
}

type RowCheckboxProps<Row> = {
  row: Row
  checked: boolean
  disabled: boolean
  label: string
  onToggle: (row: Row, checked: boolean) => void
}

function RowCheckbox<Row>({ row, checked, disabled, label, onToggle }: RowCheckboxProps<Row>) {
  return (
    <input
      type="checkbox"
      className="border-border h-4 w-4 rounded"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(event) => {
        if (disabled) return
        onToggle(row, event.target.checked)
      }}
    />
  )
}

/**
 * Compose DataTable with feature-agnostic sorting, selection, slots, and batch actions.
 */
export function InteractiveTable<Row, SortKey extends string = string>({
  columns,
  rows,
  getRowId,
  caption,
  sort,
  onSortChange,
  selection,
  batchActions = [],
  filters,
  pagination,
  emptyState,
  errorState,
  isLoading = false,
  loadingRowCount,
  loadingState,
  onRowClick,
  rowClassName,
  scrollAreaClassName,
  stickyHeader,
  tableClassName,
  className,
  ...props
}: InteractiveTableProps<Row, SortKey>) {
  const { t } = useTranslation()
  const selectedRowIdSet = useMemo(
    () => new Set(selection?.selectedRowIds ?? []),
    [selection?.selectedRowIds],
  )
  const selectableRows = useMemo(() => {
    if (!selection) return []
    return rows.filter((row) => selection.getRowSelectable?.(row) ?? true)
  }, [rows, selection])
  const selectedRows = useMemo(() => {
    return selectableRows.filter((row) => selectedRowIdSet.has(getRowId(row)))
  }, [getRowId, selectableRows, selectedRowIdSet])
  const allRowsSelected = selectableRows.length > 0 && selectedRows.length === selectableRows.length
  const partiallySelected = selectedRows.length > 0 && selectedRows.length < selectableRows.length
  const canToggleCurrentPage = !isLoading && !errorState && selectableRows.length > 0
  const hasSelectionBar = Boolean(selection && selectedRows.length > 0)
  const hasToolbar = Boolean(filters || hasSelectionBar)
  const resolvedRowClassName = useMemo<DataTableProps<Row>['rowClassName']>(() => {
    if (!selection) {
      return rowClassName
    }

    return (row: Row) =>
      cn(
        selectedRowIdSet.has(getRowId(row)) && 'bg-surface-container-low',
        typeof rowClassName === 'function' ? rowClassName(row) : rowClassName,
      )
  }, [getRowId, rowClassName, selectedRowIdSet, selection])

  const dataColumns = useMemo<readonly DataTableColumn<Row>[]>(() => {
    const mappedColumns = columns.map<DataTableColumn<Row>>((column) => ({
      key: column.id,
      header:
        column.sortKey && onSortChange ? (
          <InteractiveTableSortableHeader
            label={column.header}
            sortKey={column.sortKey}
            sort={sort}
            defaultSortDirection={column.defaultSortDirection}
            onSortChange={onSortChange}
            ariaLabel={column.sortAriaLabel}
          />
        ) : (
          column.header
        ),
      cell: column.cell,
      className: column.className,
      headerClassName: column.headerClassName,
    }))

    if (!selection) {
      return mappedColumns
    }

    return [
      {
        key: SELECTION_COLUMN_ID,
        header: (
          <SelectAllCheckbox
            label={selection.selectAllLabel ?? t('components.dataTable.selectAll')}
            rows={selectableRows}
            checked={allRowsSelected}
            indeterminate={partiallySelected}
            disabled={!canToggleCurrentPage}
            onToggle={selection.onToggleCurrentPage}
          />
        ),
        cell: (row) => {
          const rowId = getRowId(row)
          const selectable = selection.getRowSelectable?.(row) ?? true

          return (
            <div data-row-click-ignore>
              <RowCheckbox
                row={row}
                checked={selectedRowIdSet.has(rowId)}
                disabled={!selectable}
                label={
                  selection.getRowLabel?.(row) ?? t('components.dataTable.selectRow', { rowId })
                }
                onToggle={selection.onToggleRow}
              />
            </div>
          )
        },
        className: 'w-12',
        headerClassName: 'w-12',
      },
      ...mappedColumns,
    ]
  }, [
    allRowsSelected,
    canToggleCurrentPage,
    columns,
    getRowId,
    onSortChange,
    partiallySelected,
    selectableRows,
    selectedRowIdSet,
    selection,
    sort,
    t,
  ])

  return (
    <div
      data-slot="interactive-table"
      className={cn(
        'bg-card flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm',
        className,
      )}
      {...props}
    >
      {hasToolbar ? (
        <div
          data-slot="interactive-table-toolbar"
          className="bg-surface-container-low/30 flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
        >
          {filters ? (
            <div data-slot="interactive-table-filters" className="min-w-0 flex-1">
              {filters}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          {selection && hasSelectionBar ? (
            <InteractiveTableBatchActionBar
              selectedRows={selectedRows}
              actions={batchActions}
              onClearSelection={selection.onClearSelection}
              selectedRowsLabel={selection.selectedRowsLabel}
              clearSelectionLabel={selection.clearSelectionLabel}
            />
          ) : null}
        </div>
      ) : null}

      <DataTable
        rows={rows}
        getRowId={getRowId}
        columns={dataColumns}
        caption={caption}
        emptyState={emptyState}
        errorState={errorState}
        isLoading={isLoading}
        loadingRowCount={loadingRowCount}
        loadingState={loadingState}
        onRowClick={onRowClick}
        rowClassName={resolvedRowClassName}
        scrollAreaClassName={scrollAreaClassName}
        stickyHeader={stickyHeader}
        className={cn('rounded-none border-0 shadow-none', tableClassName)}
      />

      {pagination}
    </div>
  )
}
