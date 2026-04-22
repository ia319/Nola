import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type MetricCardProps = ComponentPropsWithoutRef<typeof Card> & {
  title: ReactNode
  value: ReactNode
  description?: ReactNode
  icon?: ReactNode
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  className,
  children,
  ...props
}: MetricCardProps) {
  return (
    <Card className={cn('gap-4 px-5 py-4', className)} {...props}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
            {title}
          </p>
          <div className="text-foreground text-3xl font-semibold tracking-tight">{value}</div>
        </div>

        {icon ? (
          <div className="text-muted-foreground bg-surface-container flex size-10 shrink-0 items-center justify-center rounded-lg border">
            {icon}
          </div>
        ) : null}
      </div>

      {description ? (
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      ) : null}
      {children ? <div className="border-outline-variant/60 border-t pt-4">{children}</div> : null}
    </Card>
  )
}
