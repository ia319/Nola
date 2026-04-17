import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'

import { HistoryPage } from '@/pages/history-center/HistoryPage'
import { ModelsPage } from '@/pages/models-management/ModelsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { SettingsTabPage } from '@/pages/settings/SettingsTabPage'
import { DEFAULT_SETTINGS_TAB, isSettingsTabKey } from '@/pages/settings/settings-tabs'
import { TaskWorkbenchPage } from '@/pages/task-workbench/TaskWorkbenchPage'
import { normalizeHistorySearch } from '@/routes/history-search'
import { AppShell } from '@/shell/AppShell'

const rootRoute = createRootRoute({
  component: AppShell,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TaskWorkbenchPage,
})

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  validateSearch: normalizeHistorySearch,
  component: HistoryPage,
})

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/models',
  component: ModelsPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: ({ location }) => {
    if (location.pathname === '/settings') {
      throw redirect({
        to: '/settings/$tab',
        params: { tab: DEFAULT_SETTINGS_TAB },
        replace: true,
      })
    }
  },
  component: SettingsPage,
})

const settingsTabRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '$tab',
  beforeLoad: ({ params }) => {
    if (!isSettingsTabKey(params.tab)) {
      throw redirect({
        to: '/settings/$tab',
        params: { tab: DEFAULT_SETTINGS_TAB },
        replace: true,
      })
    }
  },
  component: SettingsTabPage,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  historyRoute,
  modelsRoute,
  settingsRoute.addChildren([settingsTabRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
