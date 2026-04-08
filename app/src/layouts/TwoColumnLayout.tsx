import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type TwoColumnLayoutRatio = 'balanced' | 'content-heavy' | 'sidebar-heavy'

export type TwoColumnLayoutProps = ComponentPropsWithoutRef<'div'> & {
  left: ReactNode
  right: ReactNode
  ratio?: TwoColumnLayoutRatio
  leftClassName?: string
  rightClassName?: string
}

const ratioClasses: Record<
  TwoColumnLayoutRatio,
  {
    left: string
    right: string
  }
> = {
  balanced: {
    left: 'lg:col-span-6',
    right: 'lg:col-span-6',
  },
  'content-heavy': {
    left: 'lg:col-span-7',
    right: 'lg:col-span-5',
  },
  'sidebar-heavy': {
    left: 'lg:col-span-5',
    right: 'lg:col-span-7',
  },
}

export function TwoColumnLayout({
  left,
  right,
  ratio = 'content-heavy',
  className,
  leftClassName,
  rightClassName,
  ...props
}: TwoColumnLayoutProps) {
  const columns = ratioClasses[ratio]

  return (
    <div
      data-slot="two-column-layout"
      className={cn('grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8', className)}
      {...props}
    >
      <div className={cn('min-w-0 space-y-6', columns.left, leftClassName)}>{left}</div>
      <div className={cn('min-w-0 space-y-6', columns.right, rightClassName)}>{right}</div>
    </div>
  )
}
