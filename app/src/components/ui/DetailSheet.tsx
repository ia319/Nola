import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DetailSheetMode = 'dialog' | 'sheet'
export type DetailSheetSize = 'default' | 'wide'

export type DetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  headerAdornment?: ReactNode
  footer?: ReactNode
  children: ReactNode
  mode?: DetailSheetMode
  size?: DetailSheetSize
  closeLabel?: string
  bodyClassName?: string
  footerClassName?: string
} & Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'children'>

const DIALOG_SIZE_CLASSES: Record<DetailSheetSize, string> = {
  default: 'max-w-3xl',
  wide: 'max-w-6xl',
}

const SHEET_SIZE_CLASSES: Record<DetailSheetSize, string> = {
  default: 'max-w-[520px]',
  wide: 'max-w-[640px]',
}

export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  eyebrow,
  headerAdornment,
  footer,
  children,
  mode = 'sheet',
  size = 'default',
  closeLabel = 'Close',
  className,
  bodyClassName,
  footerClassName,
  ...props
}: DetailSheetProps) {
  const shellClassName =
    mode === 'dialog'
      ? cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-xl',
          DIALOG_SIZE_CLASSES[size],
        )
      : cn(
          'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col overflow-hidden border-l bg-background shadow-xl',
          SHEET_SIZE_CLASSES[size],
        )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          data-slot="detail-sheet"
          data-mode={mode}
          className={cn(shellClassName, className)}
          {...props}
        >
          <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
            <div className="min-w-0 space-y-2">
              {eyebrow ? (
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                  {eyebrow}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <DialogPrimitive.Title className="text-foreground text-xl font-semibold tracking-tight">
                  {title}
                </DialogPrimitive.Title>
                {headerAdornment}
              </div>

              {description ? (
                <DialogPrimitive.Description className="text-muted-foreground text-sm leading-6">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>

            <DialogPrimitive.Close asChild>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={closeLabel}>
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div
            data-slot="detail-sheet-body"
            className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', bodyClassName)}
          >
            {children}
          </div>

          {footer ? (
            <div className={cn('border-t px-6 py-4', footerClassName)}>{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
