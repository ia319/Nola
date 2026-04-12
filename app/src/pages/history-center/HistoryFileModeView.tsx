import { useTranslation } from 'react-i18next'

import { HistoryFileRecordsView } from './HistoryFileRecordsView'
import { useHistoryFiles } from './useHistoryFiles'
import type { HistoryFileQuery, HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'

export interface HistoryFileModeViewProps {
  query: HistoryFileQuery
  onPageClamp?: (page: number) => void
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
  onCreateTask?: () => void
}

export function HistoryFileModeView({
  query,
  onPageClamp,
  onPageChange,
  onPageSizeChange,
  onModeChange,
  onCreateTask,
}: HistoryFileModeViewProps) {
  const { t } = useTranslation()
  const historyFiles = useHistoryFiles({
    query,
    onPageClamp,
  })

  return (
    <HistoryFileRecordsView
      files={historyFiles.files}
      query={query}
      total={historyFiles.total}
      isLoading={historyFiles.isLoading}
      errorMessage={
        historyFiles.error ? t(historyFiles.error.i18nKey, historyFiles.error.params ?? {}) : null
      }
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onModeChange={onModeChange}
      onCreateTask={onCreateTask}
    />
  )
}
