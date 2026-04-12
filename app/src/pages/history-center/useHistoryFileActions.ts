import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { requestTaskRefresh } from '@/features/tasks'
import { deleteFile } from '@/features/upload/api'
import { queryKeys } from '@/shared/lib/query-keys'
import type { FileInfo } from '@/shared/types'

export interface UseHistoryFileActionsResult {
  deletingFileId: string | null
  deleteHistoryFile: (file: FileInfo) => Promise<void>
}

export function useHistoryFileActions(): UseHistoryFileActionsResult {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (file: FileInfo) => {
      setDeletingFileId(file.file_id)
      return deleteFile(file.file_id)
    },
    onSuccess: async (_response, file) => {
      toast.success(t('history.files.toast.deleted', { filename: file.filename }))
      requestTaskRefresh()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.files.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.files.details() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() }),
      ])
    },
    onError: () => {
      toast.error(t('history.files.toast.deleteFailed'))
    },
    onSettled: () => {
      setDeletingFileId(null)
    },
  })

  return {
    deletingFileId,
    deleteHistoryFile: async (file) => {
      await deleteMutation.mutateAsync(file)
    },
  }
}
