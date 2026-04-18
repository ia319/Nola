import { getRouteApi } from '@tanstack/react-router'

import { HistoryPage } from '@/pages/history-center/HistoryPage'
import { DEFAULT_SETTINGS_TAB, isSettingsTabKey } from '@/pages/settings/settings-tabs'
import { SettingsTabPage } from '@/pages/settings/SettingsTabPage'
import {
  isSameHistorySearch,
  normalizeHistorySearch,
  type HistoryRouteSearch,
} from './history-search'

const historyRouteApi = getRouteApi('/history')
const localizedHistoryRouteApi = getRouteApi('/$locale/history')
const settingsTabRouteApi = getRouteApi('/settings/$tab')
const localizedSettingsTabRouteApi = getRouteApi('/$locale/settings/$tab')

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

export function HistoryRoutePage() {
  const navigate = historyRouteApi.useNavigate()

  return (
    <HistoryPage
      search={historyRouteApi.useSearch()}
      updateSearch={createHistorySearchUpdater(navigate)}
    />
  )
}

export function LocalizedHistoryRoutePage() {
  const navigate = localizedHistoryRouteApi.useNavigate()

  return (
    <HistoryPage
      search={localizedHistoryRouteApi.useSearch()}
      updateSearch={createHistorySearchUpdater(navigate)}
    />
  )
}

export function SettingsTabRoutePage() {
  const tab = settingsTabRouteApi.useParams().tab

  return <SettingsTabPage tab={isSettingsTabKey(tab) ? tab : DEFAULT_SETTINGS_TAB} />
}

export function LocalizedSettingsTabRoutePage() {
  const tab = localizedSettingsTabRouteApi.useParams().tab

  return <SettingsTabPage tab={isSettingsTabKey(tab) ? tab : DEFAULT_SETTINGS_TAB} />
}
