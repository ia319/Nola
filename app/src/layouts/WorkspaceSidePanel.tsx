import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type WorkspaceSidePanelSize = 'default' | 'wide'

export interface WorkspaceSidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  headerAdornment?: ReactNode
  footer?: ReactNode
  children: ReactNode
  size?: WorkspaceSidePanelSize
  closeLabel?: string
  className?: string
  bodyClassName?: string
  footerClassName?: string
}

const SIDE_PANEL_SIZE_CLASSES: Record<WorkspaceSidePanelSize, string> = {
  default: 'lg:w-[360px] xl:w-[400px]',
  wide: 'lg:w-[440px] xl:w-[520px]',
}

export function WorkspaceSidePanel({
  open,
  onOpenChange,
  title,
  description,
  eyebrow,
  headerAdornment,
  footer,
  children,
  size = 'default',
  closeLabel,
  className,
  bodyClassName,
  footerClassName,
}: WorkspaceSidePanelProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const resolvedCloseLabel = closeLabel ?? t('components.workspaceSidePanel.close')
  const closePanel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return

    const activeElement = document.activeElement
    previouslyFocusedElementRef.current =
      activeElement instanceof HTMLElement ? activeElement : null
    closeButtonRef.current?.focus()

    return () => {
      const elementToRestore = previouslyFocusedElementRef.current
      previouslyFocusedElementRef.current = null

      if (elementToRestore?.isConnected) {
        elementToRestore.focus()
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return

      event.stopPropagation()
      closePanel()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closePanel, open])

  if (!open) {
    return null
  }

  return (
    <aside
      data-slot="workspace-side-panel"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'bg-background flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-md border shadow-sm lg:h-full',
        SIDE_PANEL_SIZE_CLASSES[size],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
              {eyebrow}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-foreground text-base font-semibold tracking-tight">
              {title}
            </h2>
            {headerAdornment}
          </div>

          {description ? (
            <p id={descriptionId} className="text-muted-foreground text-sm leading-6">
              {description}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          ref={closeButtonRef}
          aria-label={resolvedCloseLabel}
          onClick={closePanel}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div
        data-slot="workspace-side-panel-body"
        className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}
      >
        {children}
      </div>

      {footer ? <div className={cn('border-t px-5 py-4', footerClassName)}>{footer}</div> : null}
    </aside>
  )
}
