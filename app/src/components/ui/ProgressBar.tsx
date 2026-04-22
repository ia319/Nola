import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export type ProgressBarProps = ComponentPropsWithoutRef<'div'> & {
  percent: number
  label?: ReactNode
  meta?: ReactNode
  showValue?: boolean
  valueLabel?: ReactNode
  progressClassName?: string
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  if (percent <= 0) return 0
  if (percent >= 100) return 100
  return percent
}

export function ProgressBar({
  percent,
  label,
  meta,
  showValue = true,
  valueLabel,
  className,
  progressClassName,
  ...props
}: ProgressBarProps) {
  const clampedPercent = clampPercent(percent)
  const resolvedValueLabel = valueLabel ?? `${Math.round(clampedPercent)}%`

  return (
    <div data-slot="progress-bar" className={cn('space-y-2', className)} {...props}>
      {label || meta || showValue ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="text-foreground min-w-0 truncate font-medium">{label}</div>
          <div className="text-muted-foreground flex shrink-0 items-center gap-2">
            {meta ? <span>{meta}</span> : null}
            {showValue ? <span>{resolvedValueLabel}</span> : null}
          </div>
        </div>
      ) : null}

      <Progress
        value={clampedPercent}
        className={cn('bg-surface-container-highest h-1.5', progressClassName)}
      />
    </div>
  )
}
