import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InteractiveBatchAction } from './types'

export type InteractiveTableBatchActionBarProps<Row> = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  selectedRows: readonly Row[]
  /** Optional commands for selected rows; clear selection remains available without actions. */
  actions: readonly InteractiveBatchAction<Row>[]
  onClearSelection: () => void
  selectedRowsLabel?: (count: number) => ReactNode
  clearSelectionLabel?: ReactNode
}

function defaultSelectedRowsLabel(count: number): string {
  return `${count} selected`
}

function resolveClearSelectionLabel(label: ReactNode): string {
  return typeof label === 'string' ? label : 'Clear selection'
}

function resolveBatchActionLabel(
  label: ReactNode,
  count: number,
  ariaLabel?: string,
): string | undefined {
  const baseLabel = ariaLabel ?? (typeof label === 'string' ? label : null)
  return baseLabel ? `${baseLabel} (${count})` : undefined
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
  if (selectedRows.length === 0) {
    return null
  }

  return (
    <div
      data-slot="interactive-table-batch-action-bar"
      className={cn(
        'bg-surface-container flex min-h-9 flex-wrap items-center gap-3 rounded-lg p-1.5',
        className,
      )}
      {...props}
    >
      <p className="px-1 text-xs font-semibold tracking-[0.18em] uppercase">
        {selectedRowsLabel(selectedRows.length)}
      </p>
      <div className="bg-border hidden h-4 w-px lg:block" />

      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const eligibleRows = action.getEligibleRows?.(selectedRows) ?? selectedRows
          const disabled = action.disabled || action.isRunning || eligibleRows.length === 0

          return (
            <Button
              key={action.id}
              type="button"
              size="xs"
              variant={action.variant ?? 'outline'}
              aria-label={resolveBatchActionLabel(
                action.label,
                eligibleRows.length,
                action.ariaLabel,
              )}
              aria-busy={action.isRunning || undefined}
              disabled={disabled}
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

        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={resolveClearSelectionLabel(clearSelectionLabel)}
          onClick={onClearSelection}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
