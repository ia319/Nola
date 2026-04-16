import { useMemo } from 'react'
import { Download, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, DataTable, EmptyState, StatusBadge } from '@/components/ui'
import type { DownloadState } from '@/features/models/hooks/useModelDownload'
import { formatMegabytes, sortModelsForDisplay } from '@/features/models/lib/model-helpers'
import { cn } from '@/lib/utils'

import type { ModelResponse } from '../types'
import { DownloadProgress } from './DownloadProgress'

export interface ModelListProps {
  models: ModelResponse[]
  downloads: Map<string, DownloadState>
  onDownload: (modelId: string) => void
  onCancel: (modelId: string) => void
  onDelete: (modelId: string) => void
  onSelect: (modelId: string) => void
}

type ModelTableRow = {
  model: ModelResponse
  downloadState?: DownloadState
}

export function ModelList({
  models,
  downloads,
  onDownload,
  onCancel,
  onDelete,
  onSelect,
}: ModelListProps) {
  const { t } = useTranslation()

  const rows = useMemo<ModelTableRow[]>(() => {
    return sortModelsForDisplay(models).map((model) => ({
      model,
      downloadState: downloads.get(model.model_id),
    }))
  }, [downloads, models])

  return (
    <DataTable
      columns={[
        {
          key: 'name',
          header: t('models.table.columns.name'),
          className: 'min-w-[220px]',
          cell: ({ model }) => (
            <div className="min-w-0 space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-foreground truncate font-semibold">{model.name}</span>
                {model.is_configured ? (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    {t('models.configured')}
                  </span>
                ) : null}
                {model.is_last_loaded ? (
                  <span className="bg-success-container text-on-success-container rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    {t('models.lastLoaded')}
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
                {model.description}
              </p>
              {model.download_progress ? (
                <p className="text-muted-foreground text-xs">
                  {t('models.table.downloadSnapshot', {
                    progress: model.download_progress.percent.toFixed(1),
                  })}
                </p>
              ) : null}
            </div>
          ),
        },
        {
          key: 'languages',
          header: t('models.table.columns.languages'),
          className: 'min-w-[140px]',
          cell: ({ model }) => (
            <span className="text-sm">
              {model.languages.trim() || t('models.fields.unavailable')}
            </span>
          ),
        },
        {
          key: 'size',
          header: t('models.table.columns.size'),
          className: 'min-w-[180px]',
          cell: ({ model }) => (
            <div className="space-y-1">
              <p className="font-medium">{formatMegabytes(model.size_bytes)}</p>
              {model.disk_usage != null ? (
                <p className="text-muted-foreground text-xs">
                  {t('models.table.diskUsage', {
                    value: formatMegabytes(model.disk_usage),
                  })}
                </p>
              ) : null}
            </div>
          ),
        },
        {
          key: 'status',
          header: t('models.table.columns.status'),
          className: 'min-w-[200px]',
          cell: ({ model, downloadState }) => {
            const resolvedStatus = downloadState?.status ?? model.status

            return (
              <div className="space-y-2">
                <StatusBadge status={resolvedStatus} />
                {downloadState ? <DownloadProgress state={downloadState} /> : null}
              </div>
            )
          },
        },
        {
          key: 'profile',
          header: t('models.table.columns.profile'),
          className: 'w-[140px]',
          // Keep these backend ranks as coarse hints only until the backend
          // exposes more reliable benchmark-style metadata.
          cell: ({ model }) => (
            <span className="text-sm font-medium">
              {t('models.table.profileValue', {
                accuracy: model.accuracy_rank,
                speed: model.speed_rank,
              })}
            </span>
          ),
        },
        {
          key: 'actions',
          header: t('models.table.columns.actions'),
          className: 'w-[190px]',
          headerClassName: 'text-right',
          cell: ({ model, downloadState }) => {
            const hasLiveDownload = downloadState != null
            const isDownloading = downloadState?.status === 'downloading'
            const isDownloaded = model.status === 'downloaded' && !hasLiveDownload
            const isPartialDownload = model.status === 'partial_download' && !hasLiveDownload
            const canDownload = !hasLiveDownload && !isDownloaded
            const canDelete = !hasLiveDownload && (isDownloaded || isPartialDownload)

            return (
              <div
                className="flex flex-wrap items-center justify-end gap-1"
                onClick={(event) => event.stopPropagation()}
              >
                {canDownload ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t('models.actions.download')}
                    onClick={() => onDownload(model.model_id)}
                  >
                    <Download />
                  </Button>
                ) : null}

                {isDownloading ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t('models.actions.cancel')}
                    onClick={() => onCancel(model.model_id)}
                  >
                    <X />
                  </Button>
                ) : null}

                {isDownloaded && !model.is_configured ? (
                  <>
                    <Button type="button" size="xs" onClick={() => onSelect(model.model_id)}>
                      {t('models.actions.select')}
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t('models.actions.delete')}
                      onClick={() => onDelete(model.model_id)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                ) : null}

                {canDelete && !isDownloaded && !model.is_configured ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t('models.actions.delete')}
                    onClick={() => onDelete(model.model_id)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}

                {canDelete && model.is_configured ? (
                  <>
                    <span
                      className={cn(
                        'text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
                      )}
                    >
                      {t('models.configured')}
                    </span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t('models.actions.delete')}
                      disabled
                    >
                      <Trash2 />
                    </Button>
                  </>
                ) : null}
              </div>
            )
          },
        },
      ]}
      rows={rows}
      getRowId={(row) => row.model.model_id}
      caption={t('models.table.caption')}
      stickyHeader
      emptyState={
        <EmptyState
          title={t('models.table.empty.title')}
          description={t('models.table.empty.description')}
        />
      }
      scrollAreaClassName="max-h-[640px]"
    />
  )
}
