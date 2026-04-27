import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InteractiveBatchAction } from './types'

export type InteractiveTableBatchActionBarProps<Row> = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  selectedRows: readonly Row[]
  actions: readonly InteractiveBatchAction<Row>[]
  onClearSelection: () => void
  selectedRowsLabel?: (count: number) => ReactNode
  clearSelectionLabel?: ReactNode
}

function defaultSelectedRowsLabel(count: number): string {
  return `${count} selected`
}

/**
 * Render batch actions for the currently selected table rows.
 */
export function InteractiveTableBatchActionBar<Row>({
  selectedRows,
  actions,
  onClearSelection,
  selectedRowsLabel = defaultSelectedRowsLabel,
  clearSelectionLabel = 'Clear selection',
  className,
  ...props
}: InteractiveTableBatchActionBarProps<Row>) {
  if (selectedRows.length === 0 || actions.length === 0) {
    return null
  }

  return (
    <div
      data-slot="interactive-table-batch-action-bar"
      className={cn(
        'border-outline-variant/70 bg-surface-container-low flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-2',
        className,
      )}
      {...props}
    >
      <p className="text-muted-foreground text-xs font-medium">
        {selectedRowsLabel(selectedRows.length)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const eligibleRows = action.getEligibleRows?.(selectedRows) ?? selectedRows
          const disabled = action.disabled || action.isRunning || eligibleRows.length === 0

          return (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.variant ?? 'outline'}
              aria-label={action.ariaLabel}
              aria-busy={action.isRunning || undefined}
              disabled={disabled}
              className="h-8"
              onClick={() => {
                if (disabled) return
                void action.run(eligibleRows)
              }}
            >
              {action.icon}
              <span>{action.label}</span>
              <span className="text-xs opacity-70">({eligibleRows.length})</span>
            </Button>
          )
        })}

        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onClearSelection}>
          {clearSelectionLabel}
        </Button>
      </div>
    </div>
  )
}
