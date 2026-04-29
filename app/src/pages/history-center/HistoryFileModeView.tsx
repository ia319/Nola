import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
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
import { requestTaskRefresh, useSessionTasksStore } from '@/features/tasks'
import type { InteractiveSortState } from '@/components/common'
import { useDetailOverlayCloseRequest } from '@/shared/lib/overlay-events'
import { queryKeys } from '@/shared/lib/query-keys'
import { HistoryFileRecordsView } from './HistoryFileRecordsView'
import { useHistoryFileAssociatedTasks } from './hooks/useHistoryFileAssociatedTasks'
import { useHistoryFileActions } from './hooks/useHistoryFileActions'
import { useHistoryFileTaskCounts } from './hooks/useHistoryFileTaskCounts'
import { useHistoryFiles } from './hooks/useHistoryFiles'
import { useHistoryTaskActions } from './hooks/useHistoryTaskActions'
import type { HistoryFileQuery, HistoryPageSize, HistoryRecordsMode } from '@/routes/history-search'
import type { FileContentTypeFilterValue } from '@/shared/lib/file-query-options'
import type { FileInfo, FileSortBy, TaskSummary } from '@/shared/types'

const LazyFileDetailContent = lazy(async () => {
  const module = await import('@/features/upload/components/FileDetailContent')
  return { default: module.FileDetailContent }
})

export interface HistoryFileModeViewProps {
  query: HistoryFileQuery
  onSearchChange: (value: string) => void
  onContentTypeChange: (value: FileContentTypeFilterValue) => void
  onSortChange: (value: InteractiveSortState<FileSortBy>) => void
  onPageClamp?: (page: number) => void
  onPageChange: (value: number) => void
  onPageSizeChange: (value: HistoryPageSize) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
  onCreateTask?: () => void
}

export function HistoryFileModeView({
  query,
  onSearchChange,
  onContentTypeChange,
  onSortChange,
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
  const [pendingDeleteFiles, setPendingDeleteFiles] = useState<readonly FileInfo[]>([])
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
  const { batchDeleteHistoryFiles, deleteHistoryFile, deletingFileId, isDeletingFiles } =
    useHistoryFileActions()
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
  const { cancelTasks, exportTask, retryTasks } = historyTaskActions

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

  const handleConfirmDelete = useCallback(async (): Promise<void> => {
    if (pendingDeleteFiles.length === 0) {
      return
    }

    try {
      const deletedFileIds = new Set<string>()
      if (pendingDeleteFiles.length === 1 && pendingDeleteFiles[0]) {
        await deleteHistoryFile(pendingDeleteFiles[0])
        deletedFileIds.add(pendingDeleteFiles[0].file_id)
      } else {
        const response = await batchDeleteHistoryFiles(pendingDeleteFiles)
        for (const result of response.results) {
          if (result.ok) {
            deletedFileIds.add(result.file_id)
          }
        }
      }

      setSelectedDetailFile((current) =>
        current && deletedFileIds.has(current.file_id) ? null : current,
      )
      setPendingDeleteFiles([])
    } catch {
      return
    }
  }, [batchDeleteHistoryFiles, deleteHistoryFile, pendingDeleteFiles])

  const handleExportAssociatedTask = useCallback(
    async (task: TaskSummary): Promise<void> => {
      await exportTask(task, {
        format: exportDefaults.defaults.format,
        include_timestamps: exportDefaults.defaults.include_timestamps,
        target: 'download',
      })
    },
    [exportDefaults.defaults.format, exportDefaults.defaults.include_timestamps, exportTask],
  )

  const handleCancelAssociatedTask = useCallback(
    async (task: TaskSummary): Promise<void> => {
      await cancelTasks([task.task_id])
    },
    [cancelTasks],
  )

  const handleRetryAssociatedTask = useCallback(
    async (task: TaskSummary): Promise<void> => {
      await retryTasks([task.task_id])
    },
    [retryTasks],
  )

  const pendingDeleteCount = pendingDeleteFiles.length
  const pendingSingleDeleteFile = pendingDeleteCount === 1 ? pendingDeleteFiles[0] : null
  const deleteBusy = deletingFileId !== null || isDeletingFiles

  return (
    <>
      <HistoryFileRecordsView
        rows={rows}
        query={query}
        total={historyFiles.total}
        isLoading={historyFiles.isLoading}
        deletingFileId={deletingFileId}
        isDeletingFiles={isDeletingFiles}
        errorMessage={
          historyFiles.error ? t(historyFiles.error.i18nKey, historyFiles.error.params ?? {}) : null
        }
        onSearchChange={onSearchChange}
        onContentTypeChange={onContentTypeChange}
        onSortChange={onSortChange}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onModeChange={onModeChange}
        onCreateTask={onCreateTask}
        onRetry={historyFiles.refresh}
        onOpenFileDetail={openFileDetail}
        onRequestDeleteFile={(file) => {
          setSelectedDetailFile((current) => (current?.file_id === file.file_id ? null : current))
          setPendingDeleteFiles([file])
        }}
        onRequestDeleteFiles={(files) => {
          setSelectedDetailFile((current) =>
            current && files.some((file) => file.file_id === current.file_id) ? null : current,
          )
          setPendingDeleteFiles(files)
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
                disabled={deleteBusy}
                onClick={() => {
                  setSelectedDetailFile(null)
                  setPendingDeleteFiles([selectedDetailRow.file])
                }}
              >
                {t('history.files.table.actions.delete')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedDetailRow ? (
          <Suspense
            fallback={
              <div className="px-6 py-8">
                <p className="text-muted-foreground text-sm">{t('history.files.detail.loading')}</p>
              </div>
            }
          >
            <LazyFileDetailContent
              file={selectedDetailRow.file}
              taskAvailability={selectedTaskAvailability}
              associatedTasks={associatedTasks}
              onExportTask={handleExportAssociatedTask}
              onRetryTask={handleRetryAssociatedTask}
              onCancelTask={handleCancelAssociatedTask}
            />
          </Suspense>
        ) : null}
      </DetailSheet>

      <Dialog
        open={pendingDeleteCount > 0}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) {
            setPendingDeleteFiles([])
          }
        }}
      >
        <DialogContent className="w-full max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {pendingSingleDeleteFile
                ? t('history.files.deleteDialog.title')
                : t('history.files.deleteDialog.batchTitle')}
            </DialogTitle>
            <DialogDescription className="min-w-0 break-words">
              {pendingSingleDeleteFile
                ? t('history.files.deleteDialog.description', {
                    filename: pendingSingleDeleteFile.filename,
                  })
                : t('history.files.deleteDialog.batchDescription', {
                    count: pendingDeleteCount,
                  })}
            </DialogDescription>
          </DialogHeader>

          {pendingSingleDeleteFile ? (
            <div className="bg-surface-container-low max-w-full min-w-0 overflow-hidden rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{pendingSingleDeleteFile.filename}</p>
                <p className="text-muted-foreground truncate font-mono text-xs tracking-tight">
                  {pendingSingleDeleteFile.file_id}
                </p>
              </div>
            </div>
          ) : pendingDeleteCount > 0 ? (
            <div className="bg-surface-container-low max-w-full min-w-0 overflow-hidden rounded-lg border px-3 py-2">
              <p className="text-sm font-semibold">
                {t('history.files.deleteDialog.batchCount', { count: pendingDeleteCount })}
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleteBusy}
              onClick={() => {
                setPendingDeleteFiles([])
              }}
            >
              {t('history.files.deleteDialog.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingDeleteCount === 0 || deleteBusy}
              onClick={() => {
                void handleConfirmDelete()
              }}
            >
              {deleteBusy
                ? t('history.files.deleteDialog.deleting')
                : t('history.files.deleteDialog.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
