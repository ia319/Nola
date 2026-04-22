import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type FormRowProps = ComponentPropsWithoutRef<'div'> & {
  label: ReactNode
  description?: ReactNode
  htmlFor?: string
  action?: ReactNode
  align?: 'start' | 'center'
  controlClassName?: string
}

export function FormRow({
  label,
  description,
  htmlFor,
  action,
  align = 'start',
  className,
  controlClassName,
  children,
  ...props
}: FormRowProps) {
  const LabelComp = htmlFor ? 'label' : 'div'

  return (
    <div
      data-slot="form-row"
      className={cn(
        'grid gap-4 border-b py-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,360px)]',
        align === 'center' ? 'md:items-center' : 'md:items-start',
        className,
      )}
      {...props}
    >
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <LabelComp
            {...(htmlFor ? { htmlFor } : {})}
            className="text-foreground text-sm font-medium"
          >
            {label}
          </LabelComp>
          {action}
        </div>
        {description ? (
          <p className="text-muted-foreground text-sm leading-6">{description}</p>
        ) : null}
      </div>

      <div className={cn('min-w-0', controlClassName)}>{children}</div>
    </div>
  )
}
