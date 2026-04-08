import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type SectionHeaderProps = ComponentPropsWithoutRef<'div'> & {
  label: ReactNode
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}

export function SectionHeader({
  label,
  title,
  description,
  icon,
  action,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="text-muted-foreground bg-surface-container flex size-10 shrink-0 items-center justify-center rounded-lg border">
            {icon}
          </div>
        ) : null}

        <div className="min-w-0 space-y-1.5">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
            {label}
          </p>
          {title ? (
            <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-muted-foreground text-sm leading-6">{description}</p>
          ) : null}
        </div>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
