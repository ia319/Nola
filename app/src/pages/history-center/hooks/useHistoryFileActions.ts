import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import logger from '@/config/logger'
import { requestTaskRefresh } from '@/features/tasks'
import { batchDeleteFiles, deleteFile } from '@/features/upload'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type { BatchFileDeleteResponse, FileInfo } from '@/shared/types'

export interface UseHistoryFileActionsResult {
  deletingFileId: string | null
  isDeletingFiles: boolean
  deleteHistoryFile: (file: FileInfo) => Promise<void>
  batchDeleteHistoryFiles: (files: readonly FileInfo[]) => Promise<BatchFileDeleteResponse>
}

export function useHistoryFileActions(): UseHistoryFileActionsResult {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  async function refreshFileAndTaskLists(): Promise<void> {
    requestTaskRefresh()
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.files.lists() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.files.details() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() }),
    ])
  }

  const deleteMutation = useMutation({
    mutationFn: async (file: FileInfo) => {
      setDeletingFileId(file.file_id)
      return deleteFile(file.file_id)
    },
    onSuccess: async (_response, file) => {
      toast.success(t('history.files.toast.deleted', { filename: file.filename }))
      await refreshFileAndTaskLists()
    },
    onError: (error, file) => {
      logger.error('history.deleteFileFailed', { error, fileId: file.file_id })
      const detail = isAppError(error) ? error.params?.detail : null
      if (typeof detail === 'string' && detail.trim()) {
        toast.error(detail)
        return
      }

      toast.error(t('history.files.toast.deleteFailed'))
    },
    onSettled: () => {
      setDeletingFileId(null)
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (files: readonly FileInfo[]) => {
      const fileIds = Array.from(
        new Set(files.map((file) => file.file_id.trim()).filter((fileId) => fileId !== '')),
      )
      if (fileIds.length === 0) {
        return {
          action: 'delete',
          summary: { requested: 0, succeeded: 0, failed: 0 },
          results: [],
        } satisfies BatchFileDeleteResponse
      }
      return batchDeleteFiles(fileIds)
    },
    onSuccess: async (response) => {
      const { summary } = response
      const linkedTaskFailures = response.results.filter(
        (result) => !result.ok && result.error_code === 'linked_tasks',
      ).length

      if (summary.succeeded > 0 && summary.failed === 0) {
        toast.success(t('history.files.toast.batchDelete.success', { count: summary.succeeded }))
      } else if (summary.succeeded > 0 && summary.failed > 0) {
        toast.warning(
          t('history.files.toast.batchDelete.partial', {
            succeeded: summary.succeeded,
            failed: summary.failed,
          }),
        )
      } else if (linkedTaskFailures > 0) {
        toast.error(t('history.files.toast.batchDelete.linkedTasks', { count: linkedTaskFailures }))
      } else if (summary.failed > 0) {
        toast.error(t('history.files.toast.batchDelete.failed', { count: summary.failed }))
      }

      if (summary.succeeded > 0) {
        await refreshFileAndTaskLists()
      }
    },
    onError: (error) => {
      logger.error('history.batchDeleteFilesFailed', { error })
      toast.error(t('history.files.toast.deleteFailed'))
    },
  })

  return {
    batchDeleteHistoryFiles: async (files) => {
      return batchDeleteMutation.mutateAsync(files)
    },
    deletingFileId,
    isDeletingFiles: batchDeleteMutation.isPending,
    deleteHistoryFile: async (file) => {
      await deleteMutation.mutateAsync(file)
    },
  }
}
