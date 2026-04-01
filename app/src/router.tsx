import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import App from '@/App'
import { AppShell } from '@/routes/AppShell'
import { HistoryPage } from '@/routes/HistoryPage'
import { ModelsPage } from '@/routes/ModelsPage'
import { normalizeHistorySearch } from '@/routes/history-search'

const rootRoute = createRootRoute({
  component: AppShell,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
})

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  validateSearch: (search: Record<string, unknown>) => normalizeHistorySearch(search),
  component: HistoryPage,
})

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/models',
  component: ModelsPage,
})

const routeTree = rootRoute.addChildren([homeRoute, historyRoute, modelsRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
