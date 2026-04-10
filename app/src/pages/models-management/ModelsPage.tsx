import type { TFunction } from 'i18next'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import {
  deleteModel,
  ModelList,
  selectModel,
  toDownloadState,
  useModelDownload,
  useModels,
} from '@/features/models'
import type { DownloadState } from '@/features/models'
import { isAppError } from '@/shared/lib/error-factory'

function toastError(t: TFunction, err: unknown) {
  if (isAppError(err)) {
    toast.error(t(err.i18nKey, err.params ?? {}))
  } else {
    toast.error(t('models.toast.actionFailed'))
  }
}

export function ModelsPage() {
  const { t } = useTranslation()
  const { models, isLoading, error, refresh } = useModels()

  // Build a seed map so in-flight downloads survive a page reload.
  const initialDownloads = useMemo(() => {
    const map = new Map<string, DownloadState>()
    for (const model of models) {
      if (model.download_progress) {
        map.set(model.model_id, toDownloadState(model.download_progress))
      }
    }
    return map
  }, [models])

  const { downloads, download, cancel } = useModelDownload(initialDownloads, refresh)

  async function handleDownload(modelId: string) {
    try {
      await download(modelId)
      toast.success(t('models.toast.downloadStarted', { modelId }))
    } catch (err) {
      toastError(t, err)
    }
  }

  async function handleCancel(modelId: string) {
    try {
      await cancel(modelId)
      toast.success(t('models.toast.downloadCancelled', { modelId }))
    } catch (err) {
      toastError(t, err)
    }
  }

  async function handleDelete(modelId: string) {
    try {
      await deleteModel(modelId)
      toast.success(t('models.toast.deleted', { modelId }))
      await refresh()
    } catch (err) {
      toastError(t, err)
    }
  }

  async function handleSelect(modelId: string) {
    try {
      const result = await selectModel(modelId)
      toast.success(t('models.toast.selected', { modelId }))
      if (result.restart_required) {
        toast.warning(t('models.restartRequired'))
      }
      await refresh()
    } catch (err) {
      toastError(t, err)
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground text-center">{t('models.loading')}</p>
  }

  if (error) {
    return <p className="text-destructive text-center">{t(error.i18nKey, error.params ?? {})}</p>
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">{t('models.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('models.description')}</p>
        </div>

        <ModelList
          models={models}
          downloads={downloads}
          onDownload={handleDownload}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onSelect={handleSelect}
        />
      </div>
    </ErrorBoundary>
  )
}
