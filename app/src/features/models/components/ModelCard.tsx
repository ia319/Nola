import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DownloadState } from '@/features/models/hooks/useModelDownload'
import {
  formatMegabytes,
  getModelActionState,
  resolveModelDescription,
} from '@/features/models/lib/model-helpers'
import type { ModelResponse } from '@/features/models/types'

import { DownloadProgress } from './DownloadProgress'

export interface ModelCardProps {
  model: ModelResponse
  downloadState?: DownloadState
  onDownload: (modelId: string) => void
  onCancel: (modelId: string) => void
  onDelete: (modelId: string) => void
  onSelect: (modelId: string) => void
}

export function ModelCard({
  model,
  downloadState,
  onDownload,
  onCancel,
  onDelete,
  onSelect,
}: ModelCardProps) {
  const { t } = useTranslation()
  const actionState = getModelActionState(model, downloadState)

  return (
    <Card
      id={`model-card-${model.model_id}`}
      className={model.is_configured ? 'border-primary/40' : ''}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{model.name}</CardTitle>
          {model.is_configured && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
              {t('models.configured')}
            </span>
          )}
          {model.is_last_loaded && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
              {t('models.lastLoaded')}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">{resolveModelDescription(t, model)}</p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">{t('models.fields.size')}: </span>
            {formatMegabytes(model.size_bytes)}
          </div>
          {model.disk_usage != null && (
            <div>
              <span className="text-muted-foreground">{t('models.fields.diskUsage')}: </span>
              {formatMegabytes(model.disk_usage)}
            </div>
          )}
          <div>
            <span className="text-muted-foreground">{t('models.fields.speed')}: </span>
            {t(`models.rank.${model.speed_rank}`)}
          </div>
          <div>
            <span className="text-muted-foreground">{t('models.fields.accuracy')}: </span>
            {t(`models.accuracyRank.${model.accuracy_rank}`)}
          </div>
        </div>

        {downloadState && <DownloadProgress state={downloadState} />}

        <div className="flex gap-2 pt-1">
          {actionState.canDownload ? (
            <Button size="sm" onClick={() => onDownload(model.model_id)}>
              {t('models.actions.download')}
            </Button>
          ) : null}

          {actionState.isDownloading && (
            <Button size="sm" variant="outline" onClick={() => onCancel(model.model_id)}>
              {t('models.actions.cancel')}
            </Button>
          )}

          {actionState.isDownloaded && !model.is_configured && (
            <>
              <Button size="sm" onClick={() => onSelect(model.model_id)}>
                {t('models.actions.select')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDelete(model.model_id)}>
                {t('models.actions.delete')}
              </Button>
            </>
          )}

          {actionState.canDelete && actionState.isPartialDownload && !model.is_configured && (
            <Button size="sm" variant="outline" onClick={() => onDelete(model.model_id)}>
              {t('models.actions.delete')}
            </Button>
          )}

          {actionState.isDownloaded && model.is_configured && (
            <span className="text-muted-foreground self-center text-xs">
              {t('models.configured')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
