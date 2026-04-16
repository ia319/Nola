import type { TFunction } from 'i18next'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { MetricCard } from '@/components/ui'
import { ContentCanvas, PageHeader } from '@/layouts'
import {
  deleteModel,
  type DownloadTerminalEvent,
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
    const detail = err.params?.detail
    if (typeof detail === 'string' && detail.trim()) {
      toast.error(detail)
      return
    }

    toast.error(t(err.i18nKey, err.params ?? {}))
  } else {
    toast.error(t('models.toast.actionFailed'))
  }
}

export function ModelsPage() {
  const { t } = useTranslation()
  const {
    models,
    configuredModelId,
    lastLoadedModelId,
    isLoading,
    hasLoaded,
    error,
    refresh,
    updateSnapshot,
  } = useModels()
  const activeModel = useMemo(
    () => models.find((model) => model.model_id === lastLoadedModelId) ?? null,
    [lastLoadedModelId, models],
  )
  const configuredModel = useMemo(
    () => models.find((model) => model.model_id === configuredModelId) ?? null,
    [configuredModelId, models],
  )

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

  function handleTerminalDownload(event: DownloadTerminalEvent) {
    if (event.status === 'completed') {
      toast.success(t('models.toast.downloadCompleted', { modelId: event.modelId }))
    } else if (event.status === 'failed') {
      if (event.error) {
        toast.error(event.error)
      } else {
        toast.error(t('models.toast.downloadFailed', { modelId: event.modelId }))
      }
    } else {
      toast.success(t('models.toast.downloadCancelled', { modelId: event.modelId }))
    }

    void refresh()
  }

  const { downloads, download, cancel } = useModelDownload(initialDownloads, handleTerminalDownload)

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
    } catch (err) {
      toastError(t, err)
    }
  }

  async function handleDelete(modelId: string) {
    try {
      await deleteModel(modelId)
      updateSnapshot((current) => ({
        ...current,
        models: current.models.filter((model) => model.model_id !== modelId),
      }))
      toast.success(t('models.toast.deleted', { modelId }))
      await refresh()
    } catch (err) {
      toastError(t, err)
    }
  }

  async function handleSelect(modelId: string) {
    try {
      const result = await selectModel(modelId)
      updateSnapshot((current) => ({
        ...current,
        configured_model_id: modelId,
        models: current.models.map((model) => ({
          ...model,
          is_configured: model.model_id === modelId,
        })),
      }))
      toast.success(t('models.toast.selected', { modelId }))
      if (result.restart_required) {
        toast.warning(t('models.restartRequired'))
      }
      await refresh()
    } catch (err) {
      toastError(t, err)
    }
  }

  if (!hasLoaded && isLoading) {
    return <p className="text-muted-foreground text-center">{t('models.loading')}</p>
  }

  if (!hasLoaded && error) {
    return <p className="text-destructive text-center">{t(error.i18nKey, error.params ?? {})}</p>
  }

  return (
    <ErrorBoundary>
      <ContentCanvas as="main" width="full" height="fill" className="gap-6" data-slot="models-page">
        <PageHeader title={t('models.title')} description={t('models.description')} />

        <section
          data-slot="models-overview"
          aria-label={t('models.overview.region')}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <MetricCard
            title={t('models.overview.activeEngine.title')}
            value={activeModel?.name ?? t('models.overview.activeEngine.empty')}
            description={
              activeModel
                ? t('models.overview.activeEngine.meta', { modelId: activeModel.model_id })
                : t('models.overview.activeEngine.emptyDescription')
            }
            className="h-full"
          />

          <MetricCard
            title={t('models.overview.defaultModel.title')}
            value={configuredModel?.name ?? t('models.overview.defaultModel.empty')}
            description={
              configuredModel
                ? t('models.overview.defaultModel.meta', { modelId: configuredModel.model_id })
                : t('models.overview.defaultModel.emptyDescription')
            }
            className="h-full"
          />

          <MetricCard
            title={t('models.overview.storagePath.title')}
            value={
              <span className="block font-mono text-base leading-6 break-all">
                {/* TODO(backend): stop exposing absolute model directories in the API, then render a safe display path here [2026-04-15] */}
                {t('models.overview.storagePath.placeholder')}
              </span>
            }
            description={t('models.overview.storagePath.meta')}
            className="h-full"
          />
        </section>

        <ModelList
          models={models}
          downloads={downloads}
          onDownload={handleDownload}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onSelect={handleSelect}
        />
      </ContentCanvas>
    </ErrorBoundary>
  )
}
