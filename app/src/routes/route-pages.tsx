import { lazy, Suspense, type ReactNode } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { DEFAULT_SETTINGS_TAB, isSettingsTabKey } from '@/pages/settings/settings-tabs'
import {
  isSameHistorySearch,
  normalizeHistorySearch,
  type HistoryRouteSearch,
} from './history-search'

const historyRouteApi = getRouteApi('/history')
const localizedHistoryRouteApi = getRouteApi('/$locale/history')
const settingsTabRouteApi = getRouteApi('/settings/$tab')
const localizedSettingsTabRouteApi = getRouteApi('/$locale/settings/$tab')
const TaskWorkbenchPage = lazy(async () => {
  const module = await import('@/pages/task-workbench/TaskWorkbenchPage')
  return { default: module.TaskWorkbenchPage }
})
const HistoryPage = lazy(async () => {
  const module = await import('@/pages/history-center/HistoryPage')
  return { default: module.HistoryPage }
})
const ModelsPage = lazy(async () => {
  const module = await import('@/pages/models-management/ModelsPage')
  return { default: module.ModelsPage }
})
const SettingsPage = lazy(async () => {
  const module = await import('@/pages/settings/SettingsPage')
  return { default: module.SettingsPage }
})
const SettingsTabPage = lazy(async () => {
  const module = await import('@/pages/settings/SettingsTabPage')
  return { default: module.SettingsTabPage }
})

type RouteLoadingLabelKey =
  | 'routes.loading.tasks'
  | 'routes.loading.history'
  | 'routes.loading.models'
  | 'routes.loading.settings'

function RouteLoadingFallback({ labelKey }: { labelKey: RouteLoadingLabelKey }) {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      aria-live="polite"
      className="text-muted-foreground flex min-h-[50vh] items-center justify-center text-sm"
    >
      {t(labelKey)}
    </div>
  )
}

function RouteSuspense({
  children,
  labelKey,
}: {
  children: ReactNode
  labelKey: RouteLoadingLabelKey
}) {
  return <Suspense fallback={<RouteLoadingFallback labelKey={labelKey} />}>{children}</Suspense>
}

function createHistorySearchUpdater(
  navigate: ReturnType<typeof historyRouteApi.useNavigate>,
): (patch: Partial<HistoryRouteSearch>, replace: boolean) => void {
  return (patch, replace) => {
    void navigate({
      replace,
      search: (previous) => {
        const next = normalizeHistorySearch({ ...previous, ...patch })
        return isSameHistorySearch(previous, next) ? previous : next
      },
    })
  }
}

export function TaskWorkbenchRoutePage() {
  return (
    <RouteSuspense labelKey="routes.loading.tasks">
      <TaskWorkbenchPage />
    </RouteSuspense>
  )
}

export function HistoryRoutePage() {
  const navigate = historyRouteApi.useNavigate()

  return (
    <RouteSuspense labelKey="routes.loading.history">
      <HistoryPage
        search={historyRouteApi.useSearch()}
        updateSearch={createHistorySearchUpdater(navigate)}
      />
    </RouteSuspense>
  )
}

export function LocalizedHistoryRoutePage() {
  const navigate = localizedHistoryRouteApi.useNavigate()

  return (
    <RouteSuspense labelKey="routes.loading.history">
      <HistoryPage
        search={localizedHistoryRouteApi.useSearch()}
        updateSearch={createHistorySearchUpdater(navigate)}
      />
    </RouteSuspense>
  )
}

export function ModelsRoutePage() {
  return (
    <RouteSuspense labelKey="routes.loading.models">
      <ModelsPage />
    </RouteSuspense>
  )
}

export function SettingsRoutePage() {
  return (
    <RouteSuspense labelKey="routes.loading.settings">
      <SettingsPage />
    </RouteSuspense>
  )
}

export function SettingsTabRoutePage() {
  const tab = settingsTabRouteApi.useParams().tab

  return (
    <RouteSuspense labelKey="routes.loading.settings">
      <SettingsTabPage tab={isSettingsTabKey(tab) ? tab : DEFAULT_SETTINGS_TAB} />
    </RouteSuspense>
  )
}

export function LocalizedSettingsTabRoutePage() {
  const tab = localizedSettingsTabRouteApi.useParams().tab

  return (
    <RouteSuspense labelKey="routes.loading.settings">
      <SettingsTabPage tab={isSettingsTabKey(tab) ? tab : DEFAULT_SETTINGS_TAB} />
    </RouteSuspense>
  )
}
