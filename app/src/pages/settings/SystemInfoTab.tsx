import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import logger from '@/config/logger'
import { checkIntegrity, cleanupOrphans } from '@/features/upload/api'
import { FormRow } from '@/layouts'
import { isAppError } from '@/shared/lib/error-factory'
import type { AppError, CleanupResponse, IntegrityCheckResponse } from '@/shared/types'

type MissingFile = IntegrityCheckResponse['missing_files'][number]

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <span className="bg-surface-container-high text-foreground inline-flex min-h-10 max-w-full items-center rounded-md px-3 text-sm">
      {value}
    </span>
  )
}

function MissingFilesList({ files }: { files: MissingFile[] }) {
  if (files.length === 0) return null

  return (
    <div className="border-outline-variant mt-3 max-h-44 overflow-auto rounded-md border">
      {files.map((file) => (
        <div key={file.id} className="border-b px-3 py-2 last:border-b-0">
          <p className="text-foreground text-sm font-medium">{file.filename}</p>
          {/* TODO(backend): Return safe missing-file display paths before showing file paths here. [2026-04-19] */}
          <p className="text-muted-foreground font-mono text-xs break-all">{file.id}</p>
        </div>
      ))}
    </div>
  )
}

function applyCleanupResult(
  current: IntegrityCheckResponse | null,
  cleanup: CleanupResponse,
): IntegrityCheckResponse | null {
  if (!current) return current

  const deletedIds = new Set(cleanup.deleted_files.map((file) => file.id))
  const missingFiles = current.missing_files.filter((file) => !deletedIds.has(file.id))
  const missingCount = Math.max(0, current.missing_count - cleanup.deleted_count)

  return {
    ...current,
    status: missingCount === 0 && missingFiles.length === 0 ? 'ok' : current.status,
    missing_count: missingFiles.length > 0 ? missingFiles.length : missingCount,
    missing_files: missingFiles,
  }
}

export function SystemInfoTab() {
  const { t } = useTranslation()
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResponse | null>(null)
  const [cleanupResult, setCleanupResult] = useState<CleanupResponse | null>(null)
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false)

  const integrityMutation = useMutation({
    mutationFn: checkIntegrity,
    onSuccess: (response) => {
      setIntegrityResult(response)
      setCleanupResult(null)
      toast.success(t('settings.systemInfo.toast.integrityChecked'))
    },
    onError: (error) => {
      logger.error('settings.systemInfo.integrityCheckFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: cleanupOrphans,
    onSuccess: (response) => {
      setCleanupResult(response)
      setIntegrityResult((current) => applyCleanupResult(current, response))
      setConfirmCleanupOpen(false)
      toast.success(t('settings.systemInfo.toast.cleanupDone'))
    },
    onError: (error) => {
      logger.error('settings.systemInfo.cleanupFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    },
  })

  const missingFiles = integrityResult?.missing_files ?? []
  const missingCount = integrityResult?.missing_count ?? 0
  const hasMissingFiles = missingCount > 0
  const integrityStatus = integrityMutation.isPending
    ? t('settings.systemInfo.values.checking')
    : integrityResult
      ? hasMissingFiles
        ? t('settings.systemInfo.values.missingCount', { count: integrityResult.missing_count })
        : t('settings.systemInfo.values.clean')
      : t('settings.systemInfo.values.notChecked')
  const cleanupStatus = cleanupResult
    ? t('settings.systemInfo.values.deletedCount', { count: cleanupResult.deleted_count })
    : hasMissingFiles
      ? t('settings.systemInfo.values.cleanupReady')
      : t('settings.systemInfo.values.cleanupBlocked')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.systemInfo.sections.architecture.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.systemInfo.fields.runtimeBoundary.label')}
            description={t('settings.systemInfo.fields.runtimeBoundary.description')}
            align="center"
          >
            <ReadOnlyValue value={t('settings.systemInfo.values.localApi')} />
          </FormRow>

          <FormRow
            label={t('settings.systemInfo.fields.fileIndex.label')}
            description={t('settings.systemInfo.fields.fileIndex.description')}
            align="center"
          >
            <ReadOnlyValue value={t('settings.systemInfo.values.databaseAndDisk')} />
          </FormRow>

          <FormRow
            label={t('settings.systemInfo.fields.modelStorage.label')}
            description={t('settings.systemInfo.fields.modelStorage.description')}
            align="center"
            className="border-b-0"
          >
            <ReadOnlyValue value={t('settings.systemInfo.values.separateSettingsPage')} />
          </FormRow>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.systemInfo.sections.integrity.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.systemInfo.fields.integrityCheck.label')}
            description={t('settings.systemInfo.fields.integrityCheck.description')}
            align="start"
            controlClassName="space-y-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <ReadOnlyValue value={integrityStatus} />
              <Button
                type="button"
                variant="outline"
                onClick={() => integrityMutation.mutate()}
                disabled={integrityMutation.isPending || cleanupMutation.isPending}
              >
                {integrityMutation.isPending
                  ? t('settings.systemInfo.actions.checking')
                  : t('settings.systemInfo.actions.check')}
              </Button>
            </div>
            <MissingFilesList files={missingFiles} />
          </FormRow>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-foreground text-[15px] leading-none font-medium">
          {t('settings.systemInfo.sections.maintenance.label')}
        </p>

        <div className="border-y">
          <FormRow
            label={t('settings.systemInfo.fields.cleanupOrphans.label')}
            description={t('settings.systemInfo.fields.cleanupOrphans.description')}
            align="center"
            className="border-b-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <ReadOnlyValue value={cleanupStatus} />
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmCleanupOpen(true)}
                disabled={
                  !hasMissingFiles || integrityMutation.isPending || cleanupMutation.isPending
                }
              >
                {cleanupMutation.isPending
                  ? t('settings.systemInfo.actions.cleaning')
                  : t('settings.systemInfo.actions.cleanup')}
              </Button>
            </div>
          </FormRow>
        </div>
      </section>

      <Dialog open={confirmCleanupOpen} onOpenChange={setConfirmCleanupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.systemInfo.confirm.title')}</DialogTitle>
            <DialogDescription>{t('settings.systemInfo.confirm.description')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCleanupOpen(false)}
              disabled={cleanupMutation.isPending}
            >
              {t('settings.systemInfo.actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending
                ? t('settings.systemInfo.actions.cleaning')
                : t('settings.systemInfo.actions.confirmCleanup')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
