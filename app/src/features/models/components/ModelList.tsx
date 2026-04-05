import { useTranslation } from 'react-i18next'

import type { DownloadState } from '@/features/models/hooks/useModelDownload'
import { sortModelsForDisplay } from '@/features/models/lib/model-helpers'
import type { ModelResponse } from '@/features/models/types'

import { ModelCard } from './ModelCard'

export interface ModelListProps {
  models: ModelResponse[]
  downloads: Map<string, DownloadState>
  onDownload: (modelId: string) => void
  onCancel: (modelId: string) => void
  onDelete: (modelId: string) => void
  onSelect: (modelId: string) => void
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

  if (models.length === 0) {
    return <p className="text-muted-foreground text-center">{t('models.empty')}</p>
  }

  const sorted = sortModelsForDisplay(models)

  return (
    <div className="grid gap-4">
      {sorted.map((model) => (
        <ModelCard
          key={model.model_id}
          model={model}
          downloadState={downloads.get(model.model_id)}
          onDownload={onDownload}
          onCancel={onCancel}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
