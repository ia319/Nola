import type { ComponentPropsWithoutRef, ElementType } from 'react'

import { cn } from '@/lib/utils'

type ContentCanvasElement = 'article' | 'div' | 'main' | 'section'
type ContentCanvasWidth = 'default' | 'wide' | 'full'
type ContentCanvasHeight = 'auto' | 'fill'

const contentCanvasWidthClasses: Record<ContentCanvasWidth, string> = {
  default: 'max-w-5xl',
  wide: 'max-w-[1400px]',
  full: 'max-w-none',
}

const contentCanvasHeightClasses: Record<ContentCanvasHeight, string> = {
  auto: 'min-h-full shrink-0',
  fill: 'min-h-0 flex-1',
}

export type ContentCanvasProps = ComponentPropsWithoutRef<'div'> & {
  as?: ContentCanvasElement
  width?: ContentCanvasWidth
  height?: ContentCanvasHeight
}

export function ContentCanvas({
  as,
  className,
  width = 'default',
  height = 'auto',
  ...props
}: ContentCanvasProps) {
  const Comp: ElementType = as ?? 'div'

  return (
    <Comp
      data-slot="content-canvas"
      className={cn(
        'mx-auto flex w-full min-w-0 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
        contentCanvasWidthClasses[width],
        contentCanvasHeightClasses[height],
        className,
      )}
      {...props}
    />
  )
}
