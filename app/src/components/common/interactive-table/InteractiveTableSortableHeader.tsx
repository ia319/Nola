import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { InteractiveSortDirection, InteractiveSortState } from './types'

export interface InteractiveTableSortableHeaderProps<SortKey extends string> {
  label: ReactNode
  sortKey: SortKey
  sort?: InteractiveSortState<SortKey> | null
  defaultSortDirection?: InteractiveSortDirection
  onSortChange: (sort: InteractiveSortState<SortKey>) => void
  ariaLabel?: string
  className?: string
}

function resolveNextDirection<SortKey extends string>(
  sortKey: SortKey,
  sort: InteractiveSortState<SortKey> | null | undefined,
  defaultSortDirection: InteractiveSortDirection,
): InteractiveSortDirection {
  if (sort?.key !== sortKey) {
    return defaultSortDirection
  }

  return sort.direction === 'asc' ? 'desc' : 'asc'
}

function resolveSortLabel(label: ReactNode, nextDirection: InteractiveSortDirection): string {
  const text = typeof label === 'string' ? label : 'column'
  return `Sort ${text} ${nextDirection === 'asc' ? 'ascending' : 'descending'}`
}

/**
 * Render a feature-agnostic sortable table header control.
 */
export function InteractiveTableSortableHeader<SortKey extends string>({
  label,
  sortKey,
  sort,
  defaultSortDirection = 'asc',
  onSortChange,
  ariaLabel,
  className,
}: InteractiveTableSortableHeaderProps<SortKey>) {
  const active = sort?.key === sortKey
  const nextDirection = resolveNextDirection(sortKey, sort, defaultSortDirection)
  const sortState = active ? sort.direction : 'none'
  const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? resolveSortLabel(label, nextDirection)}
      data-sort-state={sortState}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-sm text-left text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        'focus-visible:ring-ring/40 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
      onClick={() => {
        onSortChange({ key: sortKey, direction: nextDirection })
      }}
    >
      <span className="truncate">{label}</span>
      <Icon
        aria-hidden="true"
        className={cn('size-3.5 shrink-0', active ? 'text-foreground' : 'text-muted-foreground/70')}
      />
    </button>
  )
}
