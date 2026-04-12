import type { ComponentPropsWithoutRef, ElementType } from 'react'

import { cn } from '@/lib/utils'

type ContentCanvasElement = 'article' | 'div' | 'main' | 'section'

export type ContentCanvasProps = ComponentPropsWithoutRef<'div'> & {
  as?: ContentCanvasElement
}

export function ContentCanvas({ as, className, ...props }: ContentCanvasProps) {
  const Comp: ElementType = as ?? 'div'

  return (
    <Comp
      data-slot="content-canvas"
      className={cn(
        'mx-auto flex min-h-full w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
        className,
      )}
      {...props}
    />
  )
}
