import type { TFunction } from 'i18next'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import logger from '@/config/logger'
import { buildExportFilename } from '@/features/export'
import type { ExportRequestOptions, SingleExportRequestOptions } from '@/features/export'
import {
  batchDeleteLiveSessionRecords,
  batchExportLiveSessions,
  deleteLiveSessionRecord,
  downloadLiveSessionExport,
  saveLiveSessionExport,
} from '@/features/realtime/api'
import { downloadBlob } from '@/shared/lib/utils'
import type { BatchLiveSessionActionResponse, LiveSessionSummary } from '@/shared/types'

export interface UseHistoryLiveActionsOptions {
  refresh: () => Promise<void>
}

export interface UseHistoryLiveActionsResult {
  deleteLiveSession: (session: Pick<LiveSessionSummary, 'session_id'>) => Promise<void>
  deleteLiveSessions: (sessionIds: string[]) => Promise<BatchLiveSessionActionResponse>
  exportLiveSession: (
    session: Pick<LiveSessionSummary, 'session_id' | 'title'>,
    options: SingleExportRequestOptions,
  ) => Promise<{ mode: 'download' } | { mode: 'save'; savedPath: string }>
  exportLiveSessions: (
    sessionIds: string[],
    options: ExportRequestOptions & { zip_name?: string | null },
  ) => Promise<void>
}

function normalizeSessionIds(sessionIds: string[]): string[] {
  return Array.from(
    new Set(sessionIds.map((value) => value.trim()).filter((value) => value !== '')),
  )
}

function notifyBatchDeleteSummary(
  summary: BatchLiveSessionActionResponse['summary'],
  t: TFunction,
): void {
  if (summary.succeeded > 0 && summary.failed === 0) {
    toast.success(t('history.live.toast.batchDelete.success', { count: summary.succeeded }))
    return
  }
  if (summary.succeeded > 0 && summary.failed > 0) {
    toast.warning(
      t('history.live.toast.batchDelete.partial', {
        failed: summary.failed,
        succeeded: summary.succeeded,
      }),
    )
    return
  }
  if (summary.failed > 0) {
    toast.error(t('history.live.toast.batchDelete.failed', { count: summary.failed }))
  }
}

export function useHistoryLiveActions({
  refresh,
}: UseHistoryLiveActionsOptions): UseHistoryLiveActionsResult {
  const { t } = useTranslation()

  const refreshAfterAction = useCallback(
    async (action: string): Promise<void> => {
      try {
        await refresh()
      } catch (error: unknown) {
        logger.error('history.refreshLiveAfterActionFailed', { action, error })
      }
    },
    [refresh],
  )

  const deleteLiveSession = useCallback(
    async (session: Pick<LiveSessionSummary, 'session_id'>): Promise<void> => {
      try {
        await deleteLiveSessionRecord(session.session_id)
        toast.success(t('history.live.toast.deleted', { sessionId: session.session_id }))
      } catch (error: unknown) {
        logger.error('history.deleteLiveSessionFailed', {
          error,
          sessionId: session.session_id,
        })
        toast.error(t('history.live.toast.actionFailed'))
        throw error
      } finally {
        await refreshAfterAction('delete')
      }
    },
    [refreshAfterAction, t],
  )

  const deleteLiveSessions = useCallback(
    async (sessionIds: string[]): Promise<BatchLiveSessionActionResponse> => {
      const normalizedSessionIds = normalizeSessionIds(sessionIds)
      if (normalizedSessionIds.length === 0) {
        return {
          action: 'delete_record',
          results: [],
          summary: { failed: 0, requested: 0, succeeded: 0 },
        }
      }

      try {
        const response = await batchDeleteLiveSessionRecords({
          session_ids: normalizedSessionIds,
        })
        notifyBatchDeleteSummary(response.summary, t)
        return response
      } catch (error: unknown) {
        logger.error('history.batchDeleteLiveSessionsFailed', { error })
        toast.error(t('history.live.toast.actionFailed'))
        throw error
      } finally {
        await refreshAfterAction('batchDelete')
      }
    },
    [refreshAfterAction, t],
  )

  const exportLiveSession = useCallback(
    async (
      session: Pick<LiveSessionSummary, 'session_id' | 'title'>,
      options: SingleExportRequestOptions,
    ): Promise<{ mode: 'download' } | { mode: 'save'; savedPath: string }> => {
      const target = options.target ?? 'download'
      const requestOptions: ExportRequestOptions = {
        format: options.format,
        include_timestamps: options.include_timestamps,
      }
      const customFilename = options.filename?.trim()

      try {
        if (target === 'save') {
          const response = await saveLiveSessionExport(session.session_id, {
            ...requestOptions,
            filename: customFilename || undefined,
          })
          toast.success(t('history.live.toast.export.saved', { path: response.saved_path }))
          return {
            mode: 'save',
            savedPath: response.saved_path,
          }
        }

        const { blob, filename: serverFilename } = await downloadLiveSessionExport(
          session.session_id,
          {
            ...requestOptions,
            filename: customFilename || undefined,
          },
        )
        const fallbackFilename = buildExportFilename({
          customFilename,
          fallbackId: session.session_id,
          format: options.format,
          sourceName: session.title,
        })
        downloadBlob(blob, serverFilename || fallbackFilename)
        toast.success(t('history.live.toast.export.one'))
        return { mode: 'download' }
      } catch (error: unknown) {
        toast.error(t('history.live.toast.actionFailed'))
        throw error
      }
    },
    [t],
  )

  const exportLiveSessions = useCallback(
    async (
      sessionIds: string[],
      options: ExportRequestOptions & { zip_name?: string | null },
    ): Promise<void> => {
      const normalizedSessionIds = normalizeSessionIds(sessionIds)
      if (normalizedSessionIds.length === 0) {
        return
      }

      const normalizedZipName = options.zip_name?.trim()

      try {
        const { blob, filename } = await batchExportLiveSessions({
          format: options.format,
          include_timestamps: options.include_timestamps,
          session_ids: normalizedSessionIds,
          zip_name: normalizedZipName ? normalizedZipName : undefined,
        })
        downloadBlob(blob, filename || 'live_export.zip')
        toast.success(
          t('history.live.toast.batchExport.success', {
            count: normalizedSessionIds.length,
          }),
        )
      } catch (error: unknown) {
        toast.error(t('history.live.toast.actionFailed'))
        throw error
      }
    },
    [t],
  )

  return {
    deleteLiveSession,
    deleteLiveSessions,
    exportLiveSession,
    exportLiveSessions,
  }
}
