import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type EmptyStateProps = ComponentPropsWithoutRef<'div'> & {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  align?: 'center' | 'left'
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  align = 'center',
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'bg-surface-container-lowest flex flex-col gap-4 rounded-xl border border-dashed px-6 py-10',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="text-muted-foreground bg-surface-container flex size-14 items-center justify-center rounded-full border">
          {icon}
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-foreground text-lg font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="text-muted-foreground max-w-xl text-sm leading-6">{description}</p>
        ) : null}
      </div>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
