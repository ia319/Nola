import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'

import { Outlet, useNavigate } from '@tanstack/react-router'

import { localizePath } from '@/app/locale/locale-routing'
import { useActiveLocale } from '@/app/locale/use-active-locale'
import { Toaster } from '@/components/ui/sonner'
import type { ActivityRouteTarget } from '@/features/activity'
import { ActivityDataBridge, selectActivityBadgeCount, useActivityStore } from '@/features/activity'
import { useTaskPolling } from '@/features/tasks'
import { requestCloseDetailOverlays } from '@/shared/lib/overlay-events'

import { ActivityCenterSheet } from './ActivityCenterSheet'
import { AppLocaleController } from './AppLocaleController'
import { AppSidebar } from './AppSidebar'
import { AppTopBar } from './AppTopBar'

type AppShellProps = {
  settingsTabs?: ReactNode
}

export function AppShell({ settingsTabs }: AppShellProps = {}) {
  useTaskPolling()
  const navigate = useNavigate()
  const activeLocale = useActiveLocale()
  const activityCount = useActivityStore(selectActivityBadgeCount)
  const [isActivityCenterOpen, setIsActivityCenterOpen] = useState(false)

  const handleActivityCenterOpenChange = useCallback((open: boolean) => {
    if (open) {
      requestCloseDetailOverlays()
    }
    setIsActivityCenterOpen(open)
  }, [])

  const handleActivityClick = useCallback(() => {
    const nextOpen = !isActivityCenterOpen
    if (nextOpen) {
      requestCloseDetailOverlays()
    }
    setIsActivityCenterOpen(nextOpen)
  }, [isActivityCenterOpen])

  const handleActivityNavigate = useCallback(
    (route: ActivityRouteTarget) => {
      void navigate({ to: localizePath(route, activeLocale) })
      setIsActivityCenterOpen(false)
    },
    [activeLocale, navigate],
  )

  return (
    <div
      data-slot="app-shell"
      className="bg-background text-foreground h-dvh min-h-dvh overflow-hidden"
    >
      <AppLocaleController />
      <ActivityDataBridge />
      <AppSidebar />
      <div
        data-slot="app-shell-workspace"
        className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden lg:ml-[var(--sidebar-width)]"
      >
        <AppTopBar
          activityCount={activityCount}
          settingsTabs={settingsTabs}
          onActivityClick={handleActivityClick}
        />

        <main
          data-slot="app-shell-main"
          className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 lg:px-6 lg:py-6 xl:px-8"
        >
          <div data-slot="app-shell-content" className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>

      <ActivityCenterSheet
        open={isActivityCenterOpen}
        onOpenChange={handleActivityCenterOpenChange}
        onNavigate={handleActivityNavigate}
      />
      <Toaster />
    </div>
  )
}
