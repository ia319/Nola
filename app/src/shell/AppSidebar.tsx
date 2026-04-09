import { Link, useLocation } from '@tanstack/react-router'
import { AudioLines, Boxes, Orbit, Settings2, TimerReset, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { useBreakpoint } from '@/shared/responsive'

type SidebarNavItem = {
  key: 'tasks' | 'history' | 'models' | 'settings'
  href?: '/' | '/history' | '/models'
  icon: LucideIcon
  labelKey: string
  disabled?: boolean
}

const SIDEBAR_NAV_ITEMS: readonly SidebarNavItem[] = [
  {
    key: 'tasks',
    href: '/',
    icon: AudioLines,
    labelKey: 'shell.navigation.tasks',
  },
  {
    key: 'history',
    href: '/history',
    icon: TimerReset,
    labelKey: 'shell.navigation.history',
  },
  {
    key: 'models',
    href: '/models',
    icon: Boxes,
    labelKey: 'shell.navigation.models',
  },
  {
    key: 'settings',
    icon: Settings2,
    labelKey: 'shell.navigation.settings',
    disabled: true,
  },
] as const

function isSidebarItemActive(pathname: string, href?: string): boolean {
  if (!href) return false
  if (href === '/') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar() {
  const { t } = useTranslation()
  const breakpoint = useBreakpoint()
  const pathname = useLocation({
    select: (location) => location.pathname,
  })

  // TODO: Render the drawer sidebar once the mobile shell lands [2026-04-09]
  if (breakpoint === 'sm') return null

  // TODO: Render the icon rail once the tablet shell lands [2026-04-09]
  if (breakpoint === 'md') return null

  return (
    <aside
      data-slot="app-sidebar"
      data-breakpoint={breakpoint}
      className="bg-sidebar text-sidebar-foreground border-sidebar-border/80 fixed inset-y-0 left-0 z-40 border-r"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <div className="flex h-full flex-col px-4 py-5">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm">
            <Orbit className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-semibold tracking-tight">Nola</p>
            <p className="text-muted-foreground text-xs font-medium">v3.0</p>
          </div>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isSidebarItemActive(pathname, item.href)
            const itemClassName = cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors',
              active
                ? 'bg-slate-200 text-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-surface-container-low hover:text-foreground',
              item.disabled && 'pointer-events-none opacity-60',
            )

            if (item.href && !item.disabled) {
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={itemClassName}
                >
                  <Icon className="size-4" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              )
            }

            return (
              <button key={item.key} type="button" disabled className={itemClassName}>
                <Icon className="size-4" />
                <span>{t(item.labelKey)}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
