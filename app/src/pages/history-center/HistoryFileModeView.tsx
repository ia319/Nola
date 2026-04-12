import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HistoryFileRecordsView } from './HistoryFileRecordsView'
import { useHistoryFileActions } from './useHistoryFileActions'
import { useHistoryFileTaskCounts } from './useHistoryFileTaskCounts'
import { useHistoryFiles } from './useHistoryFiles'
import type { HistoryFileQuery, HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'
import type { FileInfo } from '@/shared/types'

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
  const [pendingDeleteFile, setPendingDeleteFile] = useState<FileInfo | null>(null)
  const historyFiles = useHistoryFiles({
    query,
    onPageClamp,
  })
  const knownTaskCounts = useHistoryFileTaskCounts()
  const { deleteHistoryFile, deletingFileId } = useHistoryFileActions()

  const rows = useMemo(() => {
    return historyFiles.files.map((file) => ({
      file,
      knownTaskCount: knownTaskCounts.get(file.file_id) ?? null,
    }))
  }, [historyFiles.files, knownTaskCounts])

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDeleteFile) {
      return
    }

    try {
      await deleteHistoryFile(pendingDeleteFile)
      setPendingDeleteFile(null)
    } catch {
      return
    }
  }

  return (
    <>
      <HistoryFileRecordsView
        rows={rows}
        query={query}
        total={historyFiles.total}
        isLoading={historyFiles.isLoading}
        deletingFileId={deletingFileId}
        errorMessage={
          historyFiles.error ? t(historyFiles.error.i18nKey, historyFiles.error.params ?? {}) : null
        }
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onModeChange={onModeChange}
        onCreateTask={onCreateTask}
        onRequestDeleteFile={(file) => {
          setPendingDeleteFile(file)
        }}
      />

      <Dialog
        open={pendingDeleteFile !== null}
        onOpenChange={(open) => {
          if (!open && deletingFileId === null) {
            setPendingDeleteFile(null)
          }
        }}
      >
        <DialogContent className="w-full max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('history.files.deleteDialog.title')}</DialogTitle>
            <DialogDescription className="min-w-0 break-words">
              {t('history.files.deleteDialog.description', {
                filename: pendingDeleteFile?.filename ?? '',
              })}
            </DialogDescription>
          </DialogHeader>

          {pendingDeleteFile ? (
            <div className="bg-surface-container-low max-w-full min-w-0 overflow-hidden rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{pendingDeleteFile.filename}</p>
                <p className="text-muted-foreground truncate font-mono text-xs tracking-tight">
                  {pendingDeleteFile.file_id}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingFileId !== null}
              onClick={() => {
                setPendingDeleteFile(null)
              }}
            >
              {t('history.files.deleteDialog.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingDeleteFile === null || deletingFileId !== null}
              onClick={() => {
                void handleConfirmDelete()
              }}
            >
              {deletingFileId !== null
                ? t('history.files.deleteDialog.deleting')
                : t('history.files.deleteDialog.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
