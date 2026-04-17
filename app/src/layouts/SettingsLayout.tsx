import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { SETTINGS_TABS } from '@/pages/settings/settings-tabs'
import { ContentCanvas } from './ContentCanvas'

export type SettingsLayoutProps = ComponentPropsWithoutRef<'div'> & {
  children?: ReactNode
  contentClassName?: string
}

function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SettingsLayout({
  className,
  children,
  contentClassName,
  ...props
}: SettingsLayoutProps) {
  const { t } = useTranslation()
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
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
              <h1 className="text-foreground text-xl font-semibold tracking-tight">
                {t('settings.title')}
              </h1>
              <p className="text-muted-foreground text-sm">{t('settings.description')}</p>
            </div>

            <nav
              aria-label={t('settings.navigationLabel')}
              className="-mx-1 flex items-center gap-1 overflow-x-auto px-1"
            >
              {SETTINGS_TABS.map((tab) => {
                const active = isTabActive(pathname, tab.href)

                return (
                  <Link
                    key={tab.key}
                    to="/settings/$tab"
                    params={{ tab: tab.key }}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                      active
                        ? 'border-foreground text-foreground'
                        : 'text-muted-foreground hover:text-foreground border-transparent',
                    )}
                  >
                    {t(tab.labelKey)}
                  </Link>
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
