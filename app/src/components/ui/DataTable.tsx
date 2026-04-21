import { type ComponentPropsWithoutRef, type ReactNode, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { EmptyState, type EmptyStateProps } from './EmptyState'

export type DataTableColumn<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

export type DataTableSelection<T> = {
  selectedRowIds: readonly string[]
  onToggleRow: (rowId: string, checked: boolean, row: T) => void
  onToggleAllRows?: (checked: boolean, rows: readonly T[]) => void
  getRowLabel?: (row: T) => string
  selectAllLabel?: string
}

export type DataTableProps<T> = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  columns: readonly DataTableColumn<T>[]
  rows: readonly T[]
  getRowId: (row: T) => string
  caption?: string
  selection?: DataTableSelection<T>
  emptyState?: EmptyStateProps | ReactNode
  errorState?: EmptyStateProps | ReactNode | null
  isLoading?: boolean
  loadingRowCount?: number
  loadingState?: ReactNode
  onRowClick?: (row: T) => void
  rowClassName?: string | ((row: T) => string | undefined)
  scrollAreaClassName?: string
  stickyHeader?: boolean
}

function isStateConfig(
  value: EmptyStateProps | ReactNode | null | undefined,
): value is EmptyStateProps {
  return Boolean(value && typeof value === 'object' && 'title' in value)
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  selection,
  emptyState,
  errorState,
  isLoading = false,
  loadingRowCount = 6,
  loadingState,
  onRowClick,
  rowClassName,
  scrollAreaClassName,
  stickyHeader = false,
  className,
  ...props
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null)
  const selectedRowIdSet = useMemo(
    () => new Set(selection?.selectedRowIds ?? []),
    [selection?.selectedRowIds],
  )
  const selectableRows = rows.length
  const selectedCount = rows.filter((row) => selectedRowIdSet.has(getRowId(row))).length
  const allRowsSelected = selectableRows > 0 && selectedCount === selectableRows
  const partiallySelected = selectedCount > 0 && selectedCount < selectableRows
  const columnCount = columns.length + (selection ? 1 : 0)
  const resolvedLoadingRowCount = Number.isFinite(loadingRowCount)
    ? Math.max(1, Math.floor(loadingRowCount))
    : 1
  const skeletonRows = Array.from({ length: resolvedLoadingRowCount })
  const skeletonWidths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-full'] as const

  useEffect(() => {
    if (!headerCheckboxRef.current) return
    headerCheckboxRef.current.indeterminate = partiallySelected
  }, [partiallySelected])

  return (
    <div
      data-slot="data-table"
      className={cn('bg-card overflow-hidden rounded-xl border shadow-sm', className)}
      {...props}
    >
      <div className={cn('overflow-x-auto', scrollAreaClassName)}>
        <table className="w-full min-w-full border-collapse text-sm" aria-busy={isLoading}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}

          <thead
            className={cn(
              'bg-surface-container-low text-muted-foreground',
              stickyHeader && 'sticky top-0 z-10',
            )}
          >
            <tr>
              {selection ? (
                <th className="w-12 px-4 py-3 text-left">
                  {selection.onToggleAllRows ? (
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      className="border-border h-4 w-4 rounded"
                      aria-label={selection.selectAllLabel ?? t('components.dataTable.selectAll')}
                      checked={allRowsSelected}
                      onChange={(event) => {
                        selection.onToggleAllRows?.(event.target.checked, rows)
                      }}
                    />
                  ) : null}
                </th>
              ) : null}

              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-left text-[11px] font-semibold tracking-[0.18em] uppercase',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              loadingState ? (
                <tr>
                  <td colSpan={columnCount} className="p-6">
                    {loadingState}
                  </td>
                </tr>
              ) : (
                skeletonRows.map((_, rowIndex) => (
                  <tr key={`loading-${rowIndex}`} className="border-outline-variant/70 border-t">
                    {selection ? (
                      <td className="px-4 py-4">
                        <div className="bg-surface-container-high size-4 rounded motion-safe:animate-pulse" />
                      </td>
                    ) : null}

                    {columns.map((column, columnIndex) => (
                      <td key={column.key} className={cn('px-4 py-4', column.className)}>
                        <div
                          className={cn(
                            'bg-surface-container-high h-4 rounded-full motion-safe:animate-pulse',
                            skeletonWidths[(rowIndex + columnIndex) % skeletonWidths.length],
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )
            ) : errorState ? (
              <tr>
                <td colSpan={columnCount} className="p-6">
                  {isStateConfig(errorState) ? <EmptyState {...errorState} /> : errorState}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="p-6">
                  {isStateConfig(emptyState) ? (
                    <EmptyState {...emptyState} />
                  ) : (
                    (emptyState ?? (
                      <EmptyState
                        title={t('components.dataTable.empty.title')}
                        description={t('components.dataTable.empty.description')}
                      />
                    ))
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowId = getRowId(row)
                const isSelected = selectedRowIdSet.has(rowId)
                const resolvedRowClassName =
                  typeof rowClassName === 'function' ? rowClassName(row) : rowClassName

                return (
                  <tr
                    key={rowId}
                    data-row-id={rowId}
                    aria-selected={isSelected || undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      'border-outline-variant/70 border-t transition-colors',
                      onRowClick && 'hover:bg-surface-container-low cursor-pointer',
                      isSelected && 'bg-surface-container-low',
                      resolvedRowClassName,
                    )}
                    onClick={() => {
                      onRowClick?.(row)
                    }}
                    onKeyDown={(event) => {
                      if (!onRowClick) return
                      if (event.target !== event.currentTarget) return
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      onRowClick(row)
                    }}
                  >
                    {selection ? (
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="border-border h-4 w-4 rounded"
                          aria-label={
                            selection.getRowLabel?.(row) ??
                            t('components.dataTable.selectRow', { rowId })
                          }
                          checked={isSelected}
                          onChange={(event) => {
                            selection.onToggleRow(rowId, event.target.checked, row)
                          }}
                        />
                      </td>
                    ) : null}

                    {columns.map((column) => (
                      <td key={column.key} className={cn('px-4 py-4 align-top', column.className)}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
