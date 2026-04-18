import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'

import { stripLocalePrefix } from '@/app/locale/locale-routing'
import { isUiLanguage } from '@/config/ui-preferences'
import { ModelsPage } from '@/pages/models-management/ModelsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { DEFAULT_SETTINGS_TAB, isSettingsTabKey } from '@/pages/settings/settings-tabs'
import {
  HistoryRoutePage,
  LocalizedHistoryRoutePage,
  LocalizedSettingsTabRoutePage,
  SettingsTabRoutePage,
} from '@/routes/route-pages'
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
  component: HistoryRoutePage,
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

const localizedHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale',
  beforeLoad: ({ location, params }) => {
    if (!isUiLanguage(params.locale)) {
      throw redirect({
        to: stripLocalePrefix(location.pathname),
        replace: true,
      })
    }
  },
  component: TaskWorkbenchPage,
})

const localizedHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale/history',
  validateSearch: normalizeHistorySearch,
  beforeLoad: ({ location, params }) => {
    if (!isUiLanguage(params.locale)) {
      throw redirect({
        to: stripLocalePrefix(location.pathname),
        replace: true,
      })
    }
  },
  component: LocalizedHistoryRoutePage,
})

const localizedModelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale/models',
  beforeLoad: ({ location, params }) => {
    if (!isUiLanguage(params.locale)) {
      throw redirect({
        to: stripLocalePrefix(location.pathname),
        replace: true,
      })
    }
  },
  component: ModelsPage,
})

const localizedSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale/settings',
  beforeLoad: ({ location, params }) => {
    if (!isUiLanguage(params.locale)) {
      throw redirect({
        to: stripLocalePrefix(location.pathname),
        replace: true,
      })
    }

    if (location.pathname === `/${params.locale}/settings`) {
      throw redirect({
        to: '/$locale/settings/$tab',
        params: { locale: params.locale, tab: DEFAULT_SETTINGS_TAB },
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
  component: SettingsTabRoutePage,
})

const localizedSettingsTabRoute = createRoute({
  getParentRoute: () => localizedSettingsRoute,
  path: '$tab',
  beforeLoad: ({ params }) => {
    if (!isSettingsTabKey(params.tab)) {
      throw redirect({
        to: '/$locale/settings/$tab',
        params: { locale: params.locale, tab: DEFAULT_SETTINGS_TAB },
        replace: true,
      })
    }
  },
  component: LocalizedSettingsTabRoutePage,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  historyRoute,
  modelsRoute,
  settingsRoute.addChildren([settingsTabRoute]),
  localizedHomeRoute,
  localizedHistoryRoute,
  localizedModelsRoute,
  localizedSettingsRoute.addChildren([localizedSettingsTabRoute]),
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
