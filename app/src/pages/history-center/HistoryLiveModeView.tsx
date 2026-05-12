import { useTranslation } from 'react-i18next'

import type { InteractiveSortState } from '@/components/common'
import type { LiveHistorySortBy, LiveSessionFilterStatus } from '@/shared/lib/live-query-options'
import { HistoryLiveRecordsView } from './HistoryLiveRecordsView'
import { useHistoryLiveActions } from './hooks/useHistoryLiveActions'
import { useHistoryLiveSessions } from './hooks/useHistoryLiveSessions'
import type { HistoryLiveQuery, HistoryPageSize } from '@/routes/history-search'

export interface HistoryLiveModeViewProps {
  query: HistoryLiveQuery
  onSearchChange: (value: string) => void
  onStatusChange: (value: LiveSessionFilterStatus) => void
  onSortChange: (value: InteractiveSortState<LiveHistorySortBy>) => void
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onPageClamp?: (page: number) => void
}

export function HistoryLiveModeView({
  query,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onPageClamp,
}: HistoryLiveModeViewProps) {
  const { t } = useTranslation()
  const historyLiveSessions = useHistoryLiveSessions({
    query,
    onPageClamp,
  })
  const historyLiveActions = useHistoryLiveActions({
    refresh: historyLiveSessions.refresh,
  })

  return (
    <HistoryLiveRecordsView
      sessions={historyLiveSessions.sessions}
      query={query}
      total={historyLiveSessions.total}
      isLoading={historyLiveSessions.isLoading}
      errorMessage={
        historyLiveSessions.error
          ? t(historyLiveSessions.error.i18nKey, historyLiveSessions.error.params ?? {})
          : null
      }
      onSearchChange={onSearchChange}
      onStatusChange={onStatusChange}
      onSortChange={onSortChange}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onRetry={historyLiveSessions.refresh}
      onDeleteLiveSession={historyLiveActions.deleteLiveSession}
      onExportLiveSession={historyLiveActions.exportLiveSession}
      onBatchDeleteLiveSessions={historyLiveActions.deleteLiveSessions}
      onBatchExportLiveSessions={historyLiveActions.exportLiveSessions}
    />
  )
}
