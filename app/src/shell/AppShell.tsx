import type { ReactNode } from 'react'

import { Outlet } from '@tanstack/react-router'

import { Toaster } from '@/components/ui/sonner'
import { useTaskPolling } from '@/features/tasks'

import { AppSidebar } from './AppSidebar'
import { AppTopBar } from './AppTopBar'

type AppShellProps = {
  settingsTabs?: ReactNode
}

export function AppShell({ settingsTabs }: AppShellProps = {}) {
  useTaskPolling()

  return (
    <div data-slot="app-shell" className="bg-background text-foreground min-h-screen">
      <AppSidebar />
      <div
        data-slot="app-shell-workspace"
        className="flex min-h-screen min-w-0 flex-col lg:ml-[var(--sidebar-width)]"
      >
        <AppTopBar settingsTabs={settingsTabs} />

        <main
          data-slot="app-shell-main"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-6 lg:py-6 xl:px-8"
        >
          <div data-slot="app-shell-content" className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  )
}
