import type { ReactNode } from 'react'

import { useLocation } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { appIcons } from '@/shared/lib/icons'
import { useBreakpoint } from '@/shared/responsive'

type AppTopBarProps = {
  activityCount?: number
  className?: string
  onActivityClick?: () => void
  onHelpClick?: () => void
  settingsTabs?: ReactNode
}

function getTopBarTitleKey(pathname: string): string {
  if (pathname === '/history' || pathname.startsWith('/history/')) {
    return 'shell.navigation.history'
  }

  if (pathname === '/models' || pathname.startsWith('/models/')) {
    return 'shell.navigation.models'
  }

  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return 'shell.navigation.settings'
  }

  return 'shell.navigation.tasks'
}

function formatActivityCount(activityCount: number): string {
  const normalizedCount = Math.max(0, activityCount)

  if (normalizedCount > 99) return '99+'
  return String(normalizedCount)
}

function formatActivityLabel(
  activityCount: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const normalizedCount = Math.max(0, activityCount)

  if (normalizedCount === 0) {
    return t('shell.topBar.actions.activity')
  }

  return t('shell.topBar.actions.activityWithCount', { count: normalizedCount })
}

export function AppTopBar({
  activityCount = 0,
  className,
  onActivityClick,
  onHelpClick,
  settingsTabs,
}: AppTopBarProps) {
  const { t } = useTranslation()
  const { resolvedTheme, theme = 'system', setTheme } = useTheme()
  const breakpoint = useBreakpoint()
  const pathname = useLocation({
    select: (location) => location.pathname,
  })

  const ActivityIcon = appIcons.activity
  const ThemeIcon = appIcons.theme
  const HelpIcon = appIcons.help
  const titleKey = getTopBarTitleKey(pathname)
  const activeTheme = theme === 'system' ? (resolvedTheme ?? 'light') : theme
  const nextTheme = activeTheme === 'dark' ? 'light' : 'dark'
  const badgeLabel = formatActivityCount(activityCount)
  const activityLabel = formatActivityLabel(activityCount, t)
  const hasActivity = activityCount > 0
  const showSettingsTabs = Boolean(
    settingsTabs && (pathname === '/settings' || pathname.startsWith('/settings/')),
  )

  return (
    <header
      data-slot="app-topbar"
      data-breakpoint={breakpoint}
      className={cn(
        'bg-background/95 border-border supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-12 items-center justify-between border-b px-4 backdrop-blur-sm lg:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-base font-semibold tracking-tight">{t(titleKey)}</h1>

        {showSettingsTabs ? (
          <div
            data-slot="settings-tabs"
            className="border-border/80 hidden min-w-0 items-center gap-2 border-l pl-3 lg:flex"
          >
            {settingsTabs}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={activityLabel}
          className="text-muted-foreground hover:bg-surface-container-low hover:text-foreground relative"
          onClick={onActivityClick}
        >
          <ActivityIcon className="size-4" />
          <span
            aria-hidden="true"
            className={cn(
              'absolute -top-0.5 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold shadow-sm',
              hasActivity
                ? 'bg-destructive text-white'
                : 'border-border bg-surface-container-high text-muted-foreground border',
            )}
          >
            {badgeLabel}
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('shell.topBar.actions.toggleTheme')}
          className="text-muted-foreground hover:bg-surface-container-low hover:text-foreground"
          onClick={() => setTheme(nextTheme)}
        >
          <ThemeIcon className="size-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('shell.topBar.actions.help')}
          className="text-muted-foreground hover:bg-surface-container-low hover:text-foreground"
          onClick={onHelpClick}
        >
          <HelpIcon className="size-4" />
        </Button>
      </div>
    </header>
  )
}
