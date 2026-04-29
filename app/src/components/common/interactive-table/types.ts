import type { ReactNode } from 'react'

export type InteractiveSortDirection = 'asc' | 'desc'

export interface InteractiveSortState<SortKey extends string> {
  key: SortKey
  direction: InteractiveSortDirection
}

export interface InteractiveTableColumn<Row, SortKey extends string = string> {
  id: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  sortKey?: SortKey
  /** Accessible column label used when sortable header content is not plain text. */
  sortAriaLabel?: string
  defaultSortDirection?: InteractiveSortDirection
  className?: string
  headerClassName?: string
}

export interface InteractiveTableSelection<Row> {
  selectedRowIds: readonly string[]
  onToggleRow: (row: Row, checked: boolean) => void
  onToggleCurrentPage: (checked: boolean, rows: readonly Row[]) => void
  onClearSelection: () => void
  getRowSelectable?: (row: Row) => boolean
  getRowLabel?: (row: Row) => string
  selectAllLabel?: string
  selectedRowsLabel?: (count: number) => ReactNode
  clearSelectionLabel?: ReactNode
}

export type InteractiveBatchActionVariant = 'default' | 'secondary' | 'outline' | 'destructive'

export interface InteractiveBatchAction<Row> {
  id: string
  label: ReactNode
  icon?: ReactNode
  run: (rows: readonly Row[]) => void | Promise<void>
  getEligibleRows?: (rows: readonly Row[]) => readonly Row[]
  disabled?: boolean
  isRunning?: boolean
  variant?: InteractiveBatchActionVariant
  ariaLabel?: string
}
