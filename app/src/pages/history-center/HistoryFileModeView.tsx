import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { localizePath } from '@/app/locale/locale-routing'
import { useActiveLocale } from '@/app/locale/use-active-locale'
import { Button } from '@/components/ui/button'
import { DetailSheet } from '@/components/ui/DetailSheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useExportDefaults } from '@/features/export'
import { requestTaskRefresh, useHistoryTaskActions, useSessionTasksStore } from '@/features/tasks'
import { FileDetailContent } from '@/features/upload'
import { useDetailOverlayCloseRequest } from '@/shared/lib/overlay-events'
import { queryKeys } from '@/shared/lib/query-keys'
import { HistoryFileRecordsView } from './HistoryFileRecordsView'
import { useHistoryFileAssociatedTasks } from './useHistoryFileAssociatedTasks'
import { useHistoryFileActions } from './useHistoryFileActions'
import { useHistoryFileTaskCounts } from './useHistoryFileTaskCounts'
import { useHistoryFiles } from './useHistoryFiles'
import type { HistoryFileQuery, HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'
import type { FileInfo, TaskSummary } from '@/shared/types'

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
  const navigate = useNavigate()
  const activeLocale = useActiveLocale()
  const queryClient = useQueryClient()
  const exportDefaults = useExportDefaults()
  const addCreatedTask = useSessionTasksStore((state) => state.addCreatedTask)
  const upsertSessionTask = useSessionTasksStore((state) => state.upsertSessionTask)
  const [pendingDeleteFile, setPendingDeleteFile] = useState<FileInfo | null>(null)
  const [selectedDetailFile, setSelectedDetailFile] = useState<FileInfo | null>(null)
  const closeFileDetail = useCallback(() => {
    setSelectedDetailFile(null)
  }, [])

  useDetailOverlayCloseRequest(closeFileDetail)

  const historyFiles = useHistoryFiles({
    query,
    onPageClamp,
  })
  const knownTaskCounts = useHistoryFileTaskCounts()
  const associatedTasks = useHistoryFileAssociatedTasks(selectedDetailFile?.file_id ?? null)
  const { deleteHistoryFile, deletingFileId } = useHistoryFileActions()
  const historyTaskActions = useHistoryTaskActions({
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
    },
    onRetryCreatedTask: (task) => {
      addCreatedTask({
        task_id: task.taskId,
        file_id: task.fileId,
        filename: task.filename,
        status: 'pending',
      })
    },
    onCancelledTask: (task) => {
      if (!useSessionTasksStore.getState().byId[task.taskId]) {
        return
      }

      upsertSessionTask({
        task_id: task.taskId,
        file_id: task.fileId,
        filename: task.filename,
        status: task.status,
      })
    },
    onActionSettled: requestTaskRefresh,
  })

  const rows = useMemo(() => {
    return historyFiles.files.map((file) => ({
      file,
      knownTaskCount: knownTaskCounts.get(file.file_id) ?? null,
    }))
  }, [historyFiles.files, knownTaskCounts])

  const selectedDetailRow = useMemo(() => {
    if (!selectedDetailFile) {
      return null
    }

    return (
      rows.find((row) => row.file.file_id === selectedDetailFile.file_id) ?? {
        file: selectedDetailFile,
        knownTaskCount: null,
      }
    )
  }, [rows, selectedDetailFile])
  const selectedTaskAvailability =
    selectedDetailRow && selectedDetailRow.knownTaskCount === null && associatedTasks.length === 0
      ? 'unknown'
      : 'known'

  const openFileDetail = useCallback((file: FileInfo) => {
    setSelectedDetailFile(file)
  }, [])

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDeleteFile) {
      return
    }

    try {
      await deleteHistoryFile(pendingDeleteFile)
      setSelectedDetailFile((current) =>
        current?.file_id === pendingDeleteFile.file_id ? null : current,
      )
      setPendingDeleteFile(null)
    } catch {
      return
    }
  }

  async function handleExportAssociatedTask(task: TaskSummary): Promise<void> {
    await historyTaskActions.exportTask(task, {
      format: exportDefaults.defaults.format,
      include_timestamps: exportDefaults.defaults.include_timestamps,
      target: 'download',
    })
  }

  async function handleCancelAssociatedTask(task: TaskSummary): Promise<void> {
    await historyTaskActions.cancelTasks([task.task_id])
  }

  async function handleRetryAssociatedTask(task: TaskSummary): Promise<void> {
    await historyTaskActions.retryTasks([task.task_id])
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
        onRetry={historyFiles.refresh}
        onOpenFileDetail={openFileDetail}
        onRequestDeleteFile={(file) => {
          setSelectedDetailFile((current) => (current?.file_id === file.file_id ? null : current))
          setPendingDeleteFile(file)
        }}
      />

      <DetailSheet
        open={selectedDetailRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDetailFile(null)
          }
        }}
        mode="dialog"
        size="default"
        eyebrow={t('history.files.detail.eyebrow')}
        title={selectedDetailRow?.file.filename ?? ''}
        description={t('history.files.detail.description')}
        closeLabel={t('history.files.detail.close')}
        footer={
          selectedDetailRow ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedDetailFile(null)
                  if (onCreateTask) {
                    onCreateTask()
                    return
                  }

                  void navigate({ to: localizePath('/', activeLocale) })
                }}
              >
                {t('history.files.detail.actions.reprocess')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deletingFileId !== null}
                onClick={() => {
                  setSelectedDetailFile(null)
                  setPendingDeleteFile(selectedDetailRow.file)
                }}
              >
                {t('history.files.table.actions.delete')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedDetailRow ? (
          <FileDetailContent
            file={selectedDetailRow.file}
            taskAvailability={selectedTaskAvailability}
            associatedTasks={associatedTasks}
            onExportTask={handleExportAssociatedTask}
            onRetryTask={handleRetryAssociatedTask}
            onCancelTask={handleCancelAssociatedTask}
          />
        ) : null}
      </DetailSheet>

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
