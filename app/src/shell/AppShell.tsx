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
      <AppTopBar settingsTabs={settingsTabs} />

      <main
        data-slot="app-shell-main"
        className="min-h-[calc(100vh-3rem)] px-4 py-6 sm:px-6 lg:ml-[var(--sidebar-width)] lg:px-8 lg:py-8"
      >
        <div data-slot="app-shell-content" className="mx-auto flex w-full max-w-5xl flex-col">
          <Outlet />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
