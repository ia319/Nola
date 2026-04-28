import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { EllipsisVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type InteractiveTableRowActionVariant = 'default' | 'destructive'

export interface InteractiveTableRowAction {
  id: string
  label: ReactNode
  icon?: ReactNode
  run: () => void | Promise<void>
  disabled?: boolean
  hidden?: boolean
  variant?: InteractiveTableRowActionVariant
  ariaLabel?: string
}

export type InteractiveTableRowActionsMenuProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  actions: readonly InteractiveTableRowAction[]
  triggerLabel?: string
  triggerClassName?: string
  align?: ComponentPropsWithoutRef<typeof DropdownMenuContent>['align']
}

/**
 * Render compact row actions for feature-provided operations.
 */
export function InteractiveTableRowActionsMenu({
  actions,
  triggerLabel = 'More actions',
  triggerClassName,
  align = 'end',
  className,
  ...props
}: InteractiveTableRowActionsMenuProps) {
  const visibleActions = actions.filter((action) => !action.hidden)

  if (visibleActions.length === 0) {
    return null
  }

  if (visibleActions.length === 1) {
    const action = visibleActions[0]
    if (!action) {
      return null
    }
    const hasIcon = Boolean(action.icon)

    return (
      <div
        data-slot="interactive-table-row-actions-menu"
        data-row-click-ignore
        className={cn('inline-flex', className)}
        {...props}
      >
        <Button
          type="button"
          variant="ghost"
          size={hasIcon ? 'icon-xs' : 'xs'}
          aria-label={action.ariaLabel}
          aria-disabled={action.disabled || undefined}
          data-disabled={action.disabled ? '' : undefined}
          data-action-variant={action.variant}
          disabled={action.disabled}
          className={cn(
            action.variant === 'destructive' && 'text-destructive hover:text-destructive',
            triggerClassName,
          )}
          onClick={() => {
            if (action.disabled) {
              return
            }
            void action.run()
          }}
        >
          {action.icon}
          <span className={hasIcon ? 'sr-only' : undefined}>{action.label}</span>
        </Button>
      </div>
    )
  }

  return (
    <div
      data-slot="interactive-table-row-actions-menu"
      data-row-click-ignore
      className={cn('inline-flex', className)}
      {...props}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={triggerLabel}
            className={triggerClassName}
          >
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align}
          sideOffset={6}
          className="min-w-36"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {visibleActions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              aria-label={action.ariaLabel}
              aria-disabled={action.disabled || undefined}
              data-disabled={action.disabled ? '' : undefined}
              disabled={action.disabled}
              variant={action.variant}
              className="gap-1.5 text-xs [&_svg]:size-3.5"
              onSelect={(event) => {
                if (action.disabled) {
                  event.preventDefault()
                  return
                }
                void action.run()
              }}
            >
              {action.icon}
              <span>{action.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
