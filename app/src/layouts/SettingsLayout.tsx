import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Link, Outlet } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { ContentCanvas } from './ContentCanvas'

export const SETTINGS_TABS = [
  {
    key: 'general',
    label: 'General',
    href: '/settings/general',
  },
  {
    key: 'transcription',
    label: 'Transcription',
    href: '/settings/transcription',
  },
  {
    key: 'export',
    label: 'Export',
    href: '/settings/export',
  },
  {
    key: 'model-storage',
    label: 'Model Storage',
    href: '/settings/model-storage',
  },
  {
    key: 'system-info',
    label: 'System Info',
    href: '/settings/system-info',
  },
] as const

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]['key']

export type SettingsTabItem = {
  key: string
  label: string
  href?: string
  disabled?: boolean
}

function isSettingsTabKey(value: string): value is SettingsTabKey {
  return SETTINGS_TABS.some((tab) => tab.key === value)
}

export type SettingsLayoutProps = ComponentPropsWithoutRef<'div'> & {
  activeTab?: string
  currentPath?: string
  tabs?: readonly SettingsTabItem[]
  children?: ReactNode
  navClassName?: string
  contentClassName?: string
}

function isTabActive(tab: SettingsTabItem, activeTab?: string, currentPath?: string) {
  if (activeTab) return tab.key === activeTab
  if (!currentPath || !tab.href) return false
  return currentPath === tab.href || currentPath.startsWith(`${tab.href}/`)
}

export function SettingsLayout({
  activeTab,
  currentPath,
  tabs = SETTINGS_TABS,
  className,
  children,
  navClassName,
  contentClassName,
  ...props
}: SettingsLayoutProps) {
  const content = children ?? <Outlet />

  return (
    <div
      data-slot="settings-layout"
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}
      {...props}
    >
      <div className="border-outline-variant/70 bg-background/95 border-b">
        <ContentCanvas width="full" className="gap-4 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h1 className="text-foreground text-xl font-semibold tracking-tight">Settings</h1>
              <p className="text-muted-foreground text-sm">
                Review and adjust product-level configuration.
              </p>
            </div>

            <nav
              aria-label="Settings sections"
              className={cn('-mx-1 flex items-center gap-1 overflow-x-auto px-1', navClassName)}
            >
              {tabs.map((tab) => {
                const active = isTabActive(tab, activeTab, currentPath)

                const tabClassName = cn(
                  'inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                  tab.disabled && 'pointer-events-none opacity-50',
                )

                if (tab.href && !tab.disabled) {
                  const canUseClientLink = isSettingsTabKey(tab.key)

                  if (canUseClientLink) {
                    return (
                      <Link
                        key={tab.key}
                        to="/settings/$tab"
                        params={{ tab: tab.key }}
                        aria-current={active ? 'page' : undefined}
                        className={tabClassName}
                      >
                        {tab.label}
                      </Link>
                    )
                  }

                  return (
                    <a
                      key={tab.key}
                      href={tab.href}
                      aria-current={active ? 'page' : undefined}
                      className={tabClassName}
                    >
                      {tab.label}
                    </a>
                  )
                }

                return (
                  <button
                    key={tab.key}
                    type="button"
                    disabled={tab.disabled}
                    aria-current={active ? 'page' : undefined}
                    className={tabClassName}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </ContentCanvas>
      </div>

      <ContentCanvas width="full" height="fill" className={cn('min-w-0', contentClassName)}>
        <div className="flex min-h-0 flex-1 flex-col">{content}</div>
      </ContentCanvas>
    </div>
  )
}
