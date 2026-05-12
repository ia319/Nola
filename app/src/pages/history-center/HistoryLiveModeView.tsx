import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { InteractiveSortState } from '@/components/common'
import { useDetailOverlayCloseRequest } from '@/shared/lib/overlay-events'
import type { LiveHistorySortBy, LiveSessionFilterStatus } from '@/shared/lib/live-query-options'
import { HistoryLiveRecordsView } from './HistoryLiveRecordsView'
import { LiveSessionDetailSheet } from './LiveSessionDetailSheet'
import { useHistoryLiveActions } from './hooks/useHistoryLiveActions'
import { useHistoryLiveDetail } from './hooks/useHistoryLiveDetail'
import { useHistoryLiveSessions } from './hooks/useHistoryLiveSessions'
import type { HistoryLiveQuery, HistoryPageSize } from '@/routes/history-search'
import type { LiveSessionSummary } from '@/shared/types'

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
  const [selectedDetailSession, setSelectedDetailSession] = useState<LiveSessionSummary | null>(
    null,
  )
  const closeLiveDetail = useCallback(() => {
    setSelectedDetailSession(null)
  }, [])

  useDetailOverlayCloseRequest(closeLiveDetail)

  const historyLiveSessions = useHistoryLiveSessions({
    query,
    onPageClamp,
  })
  const historyLiveDetail = useHistoryLiveDetail(selectedDetailSession?.session_id ?? null)
  const historyLiveActions = useHistoryLiveActions({
    refresh: historyLiveSessions.refresh,
  })

  return (
    <>
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
        onOpenLiveDetail={setSelectedDetailSession}
        onDeleteLiveSession={historyLiveActions.deleteLiveSession}
        onExportLiveSession={historyLiveActions.exportLiveSession}
        onBatchDeleteLiveSessions={historyLiveActions.deleteLiveSessions}
        onBatchExportLiveSessions={historyLiveActions.exportLiveSessions}
      />

      <LiveSessionDetailSheet
        open={selectedDetailSession !== null}
        summarySession={selectedDetailSession}
        detailSession={historyLiveDetail.session}
        error={historyLiveDetail.error}
        onOpenChange={(open) => {
          if (!open) {
            closeLiveDetail()
          }
        }}
      />
    </>
  )
}
