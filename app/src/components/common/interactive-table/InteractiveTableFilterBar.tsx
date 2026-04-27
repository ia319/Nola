import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type InteractiveTableFilterBarProps = ComponentPropsWithoutRef<'div'> & {
  leading?: ReactNode
  trailing?: ReactNode
}

/**
 * Keep table filters in a consistent responsive shell.
 */
export function InteractiveTableFilterBar({
  leading,
  trailing,
  children,
  className,
  ...props
}: InteractiveTableFilterBarProps) {
  return (
    <div
      data-slot="interactive-table-filter-bar"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{leading ?? children}</div>
      {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  )
}
