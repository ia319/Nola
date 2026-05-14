import type { TFunction } from 'i18next'
import { CheckCircle2, Download, Trash2, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorBoundary, type InteractiveSortState } from '@/components/common'
import { Button, DetailSheet, EmptyState, MetricCard, StatusBadge } from '@/components/ui'
import { refreshConfigCaches } from '@/config/cache-invalidation'
import logger from '@/config/logger'
import { ContentCanvas, PageHeader } from '@/layouts'
import {
  deleteModel,
  DEFAULT_MODEL_LIST_QUERY,
  type DownloadTerminalEvent,
  getModelActionState,
  getModelDetail,
  getModelSettings,
  ModelList,
  type ModelDetailResponse,
  type ModelListQuery,
  type ModelListResponse,
  type ModelListSortBy,
  requestModelRefresh,
  resolveModelDescription,
  selectModel,
  toDownloadState,
  useModelDownload,
  useModels,
} from '@/features/models'
import type { DownloadState } from '@/features/models'
import { isAppError } from '@/shared/lib/error-factory'
import { useDetailOverlayCloseRequest } from '@/shared/lib/overlay-events'
import { queryClient } from '@/shared/lib/query-client'
import { queryKeys } from '@/shared/lib/query-keys'
import type { AppError } from '@/shared/types'

const LazyModelDetailContent = lazy(async () => {
  const module = await import('@/features/models/components/ModelDetailContent')
  return { default: module.ModelDetailContent }
})

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

async function runModelAction(t: TFunction, action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (err: unknown) {
    toastError(t, err)
  }
}

export function ModelsPage() {
  const { t } = useTranslation()
  const {
    models: overviewModels,
    configuredModelId,
    lastLoadedModelId,
    isLoading: isOverviewLoading,
    hasLoaded: hasOverviewLoaded,
    updateSnapshot: updateOverviewSnapshot,
  } = useModels()
  const [modelListQuery, setModelListQuery] = useState<ModelListQuery>(DEFAULT_MODEL_LIST_QUERY)
  const {
    models,
    isLoading,
    hasLoaded,
    error,
    refresh,
    updateSnapshot: updateListSnapshot,
  } = useModels(modelListQuery)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ModelDetailResponse | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<AppError | null>(null)
  const detailControllerRef = useRef<AbortController | null>(null)
  const selectedModelIdRef = useRef<string | null>(null)
  const activeModelActionIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    selectedModelIdRef.current = selectedModelId
  }, [selectedModelId])

  const closeModelDetail = useCallback(() => {
    setSelectedModelId(null)
  }, [])

  useDetailOverlayCloseRequest(closeModelDetail)

  const activeModel = useMemo(
    () => overviewModels.find((model) => model.model_id === lastLoadedModelId) ?? null,
    [lastLoadedModelId, overviewModels],
  )
  const configuredModel = useMemo(
    () => overviewModels.find((model) => model.model_id === configuredModelId) ?? null,
    [configuredModelId, overviewModels],
  )
  const selectedListModel = useMemo(
    () => models.find((model) => model.model_id === selectedModelId) ?? null,
    [models, selectedModelId],
  )

  // Build a seed map so in-flight downloads survive a page reload.
  const initialDownloads = useMemo(() => {
    const map = new Map<string, DownloadState>()
    for (const model of overviewModels) {
      if (model.download_progress) {
        map.set(model.model_id, toDownloadState(model.download_progress))
      }
    }
    return map
  }, [overviewModels])

  function updateModelListQuery(updater: (current: ModelListQuery) => ModelListQuery): void {
    setModelListQuery((current) => {
      const next = updater(current)
      if (
        next.q === current.q &&
        next.status === current.status &&
        next.sort_by === current.sort_by &&
        next.order === current.order
      ) {
        return current
      }

      return next
    })
  }

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

    requestModelRefresh()
    void queryClient.invalidateQueries({ queryKey: queryKeys.models.downloads() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.models.list() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.models.detail(event.modelId) })

    if (event.status === 'completed') {
      void refreshConfigCaches().catch((error: unknown) => {
        logger.error('models.download.configRefreshFailed', { error, modelId: event.modelId })
      })
    }

    if (selectedModelIdRef.current === event.modelId) {
      void loadModelDetail(event.modelId)
    }
  }

  const { downloads, download, cancel } = useModelDownload(initialDownloads, handleTerminalDownload)
  const selectedDownloadState = useMemo(
    () => (selectedModelId ? downloads.get(selectedModelId) : undefined),
    [downloads, selectedModelId],
  )

  async function runModelMutation(modelId: string, action: () => Promise<void>): Promise<void> {
    if (activeModelActionIdsRef.current.has(modelId)) {
      return
    }

    activeModelActionIdsRef.current.add(modelId)
    try {
      await runModelAction(t, action)
    } finally {
      activeModelActionIdsRef.current.delete(modelId)
    }
  }

  async function handleDownload(modelId: string) {
    await runModelMutation(modelId, async () => {
      await download(modelId)
      requestModelRefresh()
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.downloads() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.list() })
      toast.success(t('models.toast.downloadStarted', { modelId }))
    })
  }

  async function handleCancel(modelId: string) {
    await runModelMutation(modelId, async () => {
      await cancel(modelId)
      requestModelRefresh()
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.downloads() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.list() })
    })
  }

  async function handleDelete(modelId: string) {
    await runModelMutation(modelId, async () => {
      await deleteModel(modelId)
      const removeModel = (current: ModelListResponse): ModelListResponse => ({
        ...current,
        models: current.models.filter((model) => model.model_id !== modelId),
      })
      updateListSnapshot(removeModel)
      updateOverviewSnapshot(removeModel)
      if (selectedModelIdRef.current === modelId) {
        setSelectedModelId(null)
      }
      toast.success(t('models.toast.deleted', { modelId }))
      requestModelRefresh()
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.detail(modelId) })
    })
  }

  async function handleSelect(modelId: string) {
    await runModelMutation(modelId, async () => {
      const result = await selectModel(modelId)
      const selectedConfiguredModelId = result.configured_model_id
      const updateConfiguredModel = (current: ModelListResponse): ModelListResponse => ({
        ...current,
        configured_model_id: selectedConfiguredModelId,
        models: current.models.map((model) => ({
          ...model,
          is_configured: model.model_id === selectedConfiguredModelId,
        })),
      })
      updateListSnapshot(updateConfiguredModel)
      updateOverviewSnapshot(updateConfiguredModel)
      setDetail((current) =>
        current === null
          ? current
          : {
              ...current,
              is_configured: current.model_id === selectedConfiguredModelId,
            },
      )
      toast.success(t('models.toast.selected', { modelId: selectedConfiguredModelId }))

      requestModelRefresh()
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.settings() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.models.detail(modelId) })
      if (selectedConfiguredModelId !== modelId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.models.detail(selectedConfiguredModelId),
        })
      }
      void refreshConfigCaches().catch((error: unknown) => {
        logger.error('models.select.configRefreshFailed', { error, modelId })
      })

      try {
        const settings = await getModelSettings()
        queryClient.setQueryData(queryKeys.models.settings(), settings)
      } catch (error: unknown) {
        logger.error('models.select.settingsRefreshFailed', { error, modelId })
      }
    })
  }

  const detailModel = detail ?? selectedListModel
  const detailActionState =
    detailModel == null ? null : getModelActionState(detailModel, selectedDownloadState)
  const isInitialLoading = !hasLoaded && isLoading
  const isOverviewInitialLoading = !hasOverviewLoaded && isOverviewLoading
  const listErrorMessage = error ? t(error.i18nKey, error.params ?? {}) : null

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

  return (
    <ErrorBoundary>
      <ContentCanvas as="main" width="full" className="gap-6" data-slot="models-page">
        <PageHeader title={t('models.title')} description={t('models.description')} />

        {!listErrorMessage ? (
          <section
            data-slot="models-overview"
            aria-label={t('models.overview.region')}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <MetricCard
              title={t('models.overview.activeEngine.title')}
              value={
                isOverviewInitialLoading ? (
                  <span className="bg-surface-container-high block h-8 w-40 rounded-full motion-safe:animate-pulse" />
                ) : (
                  (activeModel?.name ?? t('models.overview.activeEngine.empty'))
                )
              }
              description={
                isOverviewInitialLoading ? (
                  <span className="bg-surface-container-high block h-4 w-48 rounded-full motion-safe:animate-pulse" />
                ) : activeModel ? (
                  t('models.overview.activeEngine.meta', { modelId: activeModel.model_id })
                ) : (
                  t('models.overview.activeEngine.emptyDescription')
                )
              }
              className="h-full"
            />

            <MetricCard
              title={t('models.overview.defaultModel.title')}
              value={
                isOverviewInitialLoading ? (
                  <span className="bg-surface-container-high block h-8 w-36 rounded-full motion-safe:animate-pulse" />
                ) : (
                  (configuredModel?.name ?? t('models.overview.defaultModel.empty'))
                )
              }
              description={
                isOverviewInitialLoading ? (
                  <span className="bg-surface-container-high block h-4 w-52 rounded-full motion-safe:animate-pulse" />
                ) : configuredModel ? (
                  t('models.overview.defaultModel.meta', { modelId: configuredModel.model_id })
                ) : (
                  t('models.overview.defaultModel.emptyDescription')
                )
              }
              className="h-full"
            />

            <MetricCard
              title={t('models.overview.storagePath.title')}
              value={
                isOverviewInitialLoading ? (
                  <span className="bg-surface-container-high block h-8 w-32 rounded-full motion-safe:animate-pulse" />
                ) : (
                  <span className="block font-mono text-base leading-6 break-all">
                    {/* TODO(backend): stop exposing absolute model directories in the API, then render a safe display path here [2026-04-15] */}
                    {t('models.overview.storagePath.placeholder')}
                  </span>
                )
              }
              description={
                isOverviewInitialLoading ? (
                  <span className="bg-surface-container-high block h-4 w-44 rounded-full motion-safe:animate-pulse" />
                ) : (
                  t('models.overview.storagePath.meta')
                )
              }
              className="h-full"
            />
          </section>
        ) : null}

        <div data-slot="models-list-region" className="pb-6 sm:pb-8">
          <ModelList
            models={models}
            downloads={downloads}
            query={modelListQuery}
            errorMessage={listErrorMessage}
            isLoading={isInitialLoading}
            onSearchChange={(search) => {
              updateModelListQuery((current) => ({
                ...current,
                q: search,
              }))
            }}
            onStatusFilterChange={(status) => {
              updateModelListQuery((current) => ({
                ...current,
                status,
              }))
            }}
            onSortChange={(sort: InteractiveSortState<ModelListSortBy>) => {
              updateModelListQuery((current) => ({
                ...current,
                sort_by: sort.key,
                order: sort.direction,
              }))
            }}
            onDownload={handleDownload}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onSelect={handleSelect}
            onOpenDetail={setSelectedModelId}
            onRetry={refresh}
          />
        </div>

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
            <Suspense
              fallback={
                <div className="flex min-h-[320px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">{t('models.detail.loading')}</p>
                </div>
              }
            >
              <LazyModelDetailContent
                model={detailModel}
                downloadState={selectedDownloadState}
                onCopyRepoId={handleCopyRepoId}
              />
            </Suspense>
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
