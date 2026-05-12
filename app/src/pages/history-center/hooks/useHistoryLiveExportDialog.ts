import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  buildExportFilename,
  type ExportDialogValue,
  type ExportRequestOptions,
  type SingleExportRequestOptions,
  useExportDefaults,
} from '@/features/export'
import type { LiveSessionSummary } from '@/shared/types'

export type ExportLiveSessionHandler = (
  session: LiveSessionSummary,
  options: SingleExportRequestOptions,
) => Promise<{ mode: 'download' } | { mode: 'save'; savedPath: string }>

export type BatchExportLiveHandler = (
  sessionIds: string[],
  options: ExportRequestOptions & { zip_name?: string | null },
) => Promise<void>

interface ExportDialogState {
  open: boolean
  mode: 'batch' | 'single'
  session: LiveSessionSummary | null
  sessionIds: string[]
}

export interface UseHistoryLiveExportDialogOptions {
  clearSelection: () => void
  onExportLiveSession?: ExportLiveSessionHandler
  onBatchExportLiveSessions?: BatchExportLiveHandler
}

const FALLBACK_EXPORT_OPTIONS: ExportRequestOptions = {
  format: 'srt',
  include_timestamps: true,
}

function createExportDialogValue(defaults: ExportRequestOptions): ExportDialogValue {
  return {
    filename: '',
    format: defaults.format,
    includeTimestamps: defaults.include_timestamps,
    saveAsDefault: false,
    target: 'download',
    zipName: '',
  }
}

export function useHistoryLiveExportDialog({
  clearSelection,
  onExportLiveSession,
  onBatchExportLiveSessions,
}: UseHistoryLiveExportDialogOptions) {
  const { t } = useTranslation()
  const exportDefaults = useExportDefaults()
  const [exportDialog, setExportDialog] = useState<ExportDialogState>({
    open: false,
    mode: 'single',
    session: null,
    sessionIds: [],
  })
  const [exportValue, setExportValue] = useState<ExportDialogValue>(() =>
    createExportDialogValue(FALLBACK_EXPORT_OPTIONS),
  )
  const [isSubmittingExport, setIsSubmittingExport] = useState(false)
  const [isUpdatingDefaults, setIsUpdatingDefaults] = useState(false)
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null)

  const singleDefaultFilename = useMemo(
    () =>
      exportDialog.mode === 'single' && exportDialog.session
        ? buildExportFilename({
            fallbackId: exportDialog.session.session_id,
            format: exportValue.format,
            sourceName: exportDialog.session.title,
          })
        : undefined,
    [exportDialog, exportValue.format],
  )

  function buildCurrentExportOptions(): ExportRequestOptions {
    return {
      format: exportValue.format,
      include_timestamps: exportValue.includeTimestamps,
    }
  }

  function buildSingleExportOptions(): SingleExportRequestOptions {
    const customFilename = exportValue.filename.trim()
    return {
      ...buildCurrentExportOptions(),
      filename: customFilename || undefined,
      target: exportValue.target,
    }
  }

  async function resolveDialogDefaults(): Promise<ExportRequestOptions | null> {
    if (!exportDefaults.isLoading) {
      return {
        format: exportDefaults.defaults.format,
        include_timestamps: exportDefaults.defaults.include_timestamps,
      }
    }

    try {
      const defaults = await exportDefaults.refresh()
      return {
        format: defaults.format,
        include_timestamps: defaults.include_timestamps,
      }
    } catch {
      toast.error(t('history.live.toast.actionFailed'))
      return null
    }
  }

  async function openSingleExportDialog(session: LiveSessionSummary): Promise<void> {
    if (!onExportLiveSession) {
      return
    }

    const defaults = await resolveDialogDefaults()
    if (!defaults) {
      return
    }

    setExportValue(createExportDialogValue(defaults))
    setExportDialog({
      mode: 'single',
      open: true,
      session,
      sessionIds: [session.session_id],
    })
  }

  async function openBatchExportDialog(sessionIds: string[]): Promise<void> {
    if (!onBatchExportLiveSessions || sessionIds.length === 0) {
      return
    }

    const defaults = await resolveDialogDefaults()
    if (!defaults) {
      return
    }

    setExportValue(createExportDialogValue(defaults))
    setExportDialog({
      mode: 'batch',
      open: true,
      session: null,
      sessionIds,
    })
  }

  function closeExportDialog(): void {
    if (isSubmittingExport) {
      return
    }

    setExportDialog((previous) => ({
      ...previous,
      open: false,
    }))
  }

  async function confirmExport(): Promise<void> {
    if (!exportDialog.open) {
      return
    }

    const options = buildCurrentExportOptions()

    setIsSubmittingExport(true)
    try {
      try {
        if (exportDialog.mode === 'single') {
          if (!onExportLiveSession || !exportDialog.session) {
            return
          }

          const result = await onExportLiveSession(exportDialog.session, buildSingleExportOptions())
          if (result.mode === 'save') {
            setLastSavedPath(result.savedPath)
          } else {
            setLastSavedPath(null)
          }
        } else {
          if (!onBatchExportLiveSessions || exportDialog.sessionIds.length === 0) {
            return
          }

          await onBatchExportLiveSessions(exportDialog.sessionIds, {
            ...options,
            zip_name: exportValue.zipName.trim() || undefined,
          })
          setLastSavedPath(null)
          clearSelection()
        }
      } catch {
        return
      }

      setExportDialog((previous) => ({
        ...previous,
        open: false,
      }))

      if (exportValue.saveAsDefault) {
        try {
          await exportDefaults.updateDefaults(options)
          toast.success(t('tasks.exportDialog.toast.defaultsSaved'))
        } catch {
          toast.error(t('history.live.toast.actionFailed'))
        }
      }
    } finally {
      setIsSubmittingExport(false)
    }
  }

  async function resetExportDefaults(): Promise<void> {
    setIsUpdatingDefaults(true)
    try {
      const defaults = await exportDefaults.resetDefaults()
      setExportValue((previous) => ({
        ...previous,
        format: defaults.format,
        includeTimestamps: defaults.include_timestamps,
      }))
      toast.success(t('tasks.exportDialog.toast.defaultsReset'))
    } catch {
      toast.error(t('history.live.toast.actionFailed'))
    } finally {
      setIsUpdatingDefaults(false)
    }
  }

  async function copySavedPath(): Promise<void> {
    if (!lastSavedPath || !navigator.clipboard?.writeText) {
      return
    }

    try {
      await navigator.clipboard.writeText(lastSavedPath)
      toast.success(t('tasks.exportDialog.toast.pathCopied'))
    } catch {
      toast.error(t('history.live.toast.actionFailed'))
    }
  }

  return {
    closeExportDialog,
    confirmExport,
    copySavedPath,
    exportDefaults,
    exportDialog,
    exportValue,
    isSubmittingExport,
    isUpdatingDefaults,
    lastSavedPath,
    openBatchExportDialog,
    openSingleExportDialog,
    resetExportDefaults,
    setExportValue,
    singleDefaultFilename,
  }
}
