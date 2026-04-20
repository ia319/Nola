import type { TFunction } from 'i18next'
import { CheckCircle2, Download, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary } from '@/components/common'
import { Button, DetailSheet, EmptyState, MetricCard, StatusBadge } from '@/components/ui'
import { ContentCanvas, PageHeader } from '@/layouts'
import {
  deleteModel,
  type DownloadTerminalEvent,
  getModelActionState,
  getModelDetail,
  ModelDetailContent,
  ModelList,
  type ModelDetailResponse,
  resolveModelDescription,
  selectModel,
  toDownloadState,
  useModelDownload,
  useModels,
} from '@/features/models'
import type { DownloadState } from '@/features/models'
import { isAppError } from '@/shared/lib/error-factory'
import { useDetailOverlayCloseRequest } from '@/shared/lib/overlay-events'
import type { AppError } from '@/shared/types'

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

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
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
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ModelDetailResponse | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<AppError | null>(null)
  const detailControllerRef = useRef<AbortController | null>(null)
  const selectedModelIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedModelIdRef.current = selectedModelId
  }, [selectedModelId])

  const closeModelDetail = useCallback(() => {
    setSelectedModelId(null)
  }, [])

  useDetailOverlayCloseRequest(closeModelDetail)

  const activeModel = useMemo(
    () => models.find((model) => model.model_id === lastLoadedModelId) ?? null,
    [lastLoadedModelId, models],
  )
  const configuredModel = useMemo(
    () => models.find((model) => model.model_id === configuredModelId) ?? null,
    [configuredModelId, models],
  )
  const selectedListModel = useMemo(
    () => models.find((model) => model.model_id === selectedModelId) ?? null,
    [models, selectedModelId],
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

  const loadModelDetail = useCallback(async (modelId: string) => {
    detailControllerRef.current?.abort()
    const controller = new AbortController()
    detailControllerRef.current = controller

    setIsDetailLoading(true)
    setDetailError(null)
    setDetail((current) => (current?.model_id === modelId ? current : null))

    try {
      const response = await getModelDetail(modelId, controller.signal)
      if (!controller.signal.aborted) {
        setDetail(response)
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return
      }

      setDetailError(toAppError(err))
    } finally {
      if (!controller.signal.aborted) {
        setIsDetailLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedModelId) {
      detailControllerRef.current?.abort()
      setDetail(null)
      setDetailError(null)
      setIsDetailLoading(false)
      return
    }

    void loadModelDetail(selectedModelId)
  }, [loadModelDetail, selectedModelId])

  useEffect(() => {
    return () => {
      detailControllerRef.current?.abort()
    }
  }, [])

  async function handleCopyRepoId(repoId: string) {
    try {
      await navigator.clipboard.writeText(repoId)
      toast.success(t('models.detail.toast.repoIdCopied'))
    } catch {
      toast.error(t('models.detail.toast.repoIdCopyFailed'))
    }
  }

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

    if (selectedModelIdRef.current === event.modelId) {
      void loadModelDetail(event.modelId)
    }
  }

  const { downloads, download, cancel } = useModelDownload(initialDownloads, handleTerminalDownload)
  const selectedDownloadState = useMemo(
    () => (selectedModelId ? downloads.get(selectedModelId) : undefined),
    [downloads, selectedModelId],
  )

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
      if (selectedModelIdRef.current === modelId) {
        setSelectedModelId(null)
      }
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
      setDetail((current) =>
        current === null
          ? current
          : {
              ...current,
              is_configured: current.model_id === modelId,
            },
      )
      toast.success(t('models.toast.selected', { modelId }))
      if (result.restart_required) {
        toast.warning(t('models.restartRequired'))
      }
      await refresh()
    } catch (err) {
      toastError(t, err)
    }
  }

  const detailModel = detail ?? selectedListModel
  const detailActionState =
    detailModel == null ? null : getModelActionState(detailModel, selectedDownloadState)

  function renderDetailFooter() {
    if (!detailModel || !detailActionState) {
      return null
    }

    if (detailActionState.isDownloading) {
      return (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center"
          onClick={() => void handleCancel(detailModel.model_id)}
        >
          <X />
          {t('models.actions.cancel')}
        </Button>
      )
    }

    if (detailModel.is_configured) {
      return (
        <div className="space-y-3">
          <Button type="button" className="w-full justify-center" disabled>
            <CheckCircle2 />
            {t('models.detail.actions.currentDefault')}
          </Button>
          <Button type="button" variant="outline" className="w-full justify-center" disabled>
            <Trash2 />
            {t('models.detail.actions.deleteCache')}
          </Button>
          <p className="text-muted-foreground text-center text-xs leading-5">
            {t('models.detail.defaultLocked')}
          </p>
        </div>
      )
    }

    if (detailActionState.canDownload) {
      return (
        <div className="space-y-3">
          <Button
            type="button"
            className="w-full justify-center"
            onClick={() => void handleDownload(detailModel.model_id)}
          >
            <Download />
            {t('models.actions.download')}
          </Button>
          {detailActionState.canDelete && detailActionState.isPartialDownload ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={() => void handleDelete(detailModel.model_id)}
            >
              <Trash2 />
              {t('models.detail.actions.deleteCache')}
            </Button>
          ) : null}
        </div>
      )
    }

    if (detailActionState.canDelete) {
      return (
        <div className="space-y-3">
          <Button
            type="button"
            className="w-full justify-center"
            onClick={() => void handleSelect(detailModel.model_id)}
          >
            <CheckCircle2 />
            {t('models.actions.select')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={() => void handleDelete(detailModel.model_id)}
          >
            <Trash2 />
            {t('models.detail.actions.deleteCache')}
          </Button>
        </div>
      )
    }

    return null
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
          onOpenDetail={setSelectedModelId}
        />

        <DetailSheet
          open={selectedModelId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedModelId(null)
            }
          }}
          mode="sheet"
          size="wide"
          eyebrow={t('models.detail.eyebrow')}
          title={detailModel?.name ?? selectedListModel?.name ?? t('models.title')}
          description={
            detailModel
              ? resolveModelDescription(t, detailModel)
              : selectedListModel
                ? resolveModelDescription(t, selectedListModel)
                : undefined
          }
          closeLabel={t('models.detail.close')}
          headerAdornment={
            detailActionState ? <StatusBadge status={detailActionState.status} /> : undefined
          }
          footer={renderDetailFooter()}
          bodyClassName="bg-surface-container-low/20"
        >
          {detailModel && !isDetailLoading && !detailError ? (
            <ModelDetailContent
              model={detailModel}
              downloadState={selectedDownloadState}
              onCopyRepoId={handleCopyRepoId}
            />
          ) : null}

          {isDetailLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <p className="text-muted-foreground text-sm">{t('models.detail.loading')}</p>
            </div>
          ) : null}

          {detailError ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <EmptyState
                title={t('models.detail.errorTitle')}
                description={t(detailError.i18nKey, detailError.params ?? {})}
              />
            </div>
          ) : null}
        </DetailSheet>
      </ContentCanvas>
    </ErrorBoundary>
  )
}
