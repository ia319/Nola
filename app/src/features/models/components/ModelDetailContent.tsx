import { useMemo } from 'react'
import { Activity, Copy, Cpu, Database, Globe2, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, ProgressBar, StatusBadge } from '@/components/ui'
import type { DownloadState } from '@/features/models/hooks/useModelDownload'
import {
  formatMegabytes,
  getModelActionState,
  resolveModelDescription,
  splitModelLanguages,
} from '@/features/models/lib/model-helpers'
import type { ModelResponse } from '@/features/models/types'

import { DownloadProgress } from './DownloadProgress'

export interface ModelDetailContentProps {
  model: ModelResponse
  downloadState?: DownloadState
  onCopyRepoId?: (repoId: string) => void
}

const MAX_MODEL_RANK = 5

function rankToPercent(rank: number): number {
  if (!Number.isFinite(rank) || rank <= 0) {
    return 0
  }

  return (Math.min(rank, MAX_MODEL_RANK) / MAX_MODEL_RANK) * 100
}

function formatModelRank(rank: number): string {
  if (!Number.isFinite(rank) || rank <= 0) {
    return `0/${MAX_MODEL_RANK}`
  }

  return `${Math.min(Math.trunc(rank), MAX_MODEL_RANK)}/${MAX_MODEL_RANK}`
}

export function ModelDetailContent({
  model,
  downloadState,
  onCopyRepoId,
}: ModelDetailContentProps) {
  const { t } = useTranslation()
  const actionState = getModelActionState(model, downloadState)
  const languages = useMemo(() => splitModelLanguages(model.languages), [model.languages])

  return (
    <div data-slot="model-detail-content" className="space-y-8">
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="bg-surface-container-low rounded-xl border px-4 py-3">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
              {t('models.detail.localState.status')}
            </p>
            <div className="mt-3">
              <StatusBadge status={actionState.status} />
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl border px-4 py-3">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
              {t('models.detail.localState.selection')}
            </p>
            <p className="mt-3 text-sm font-semibold">
              {model.is_configured
                ? t('models.detail.localState.selectionConfigured')
                : t('models.detail.localState.selectionAvailable')}
            </p>
          </div>

          <div className="bg-surface-container-low rounded-xl border px-4 py-3">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
              {t('models.detail.localState.runtime')}
            </p>
            <p className="mt-3 text-sm font-semibold">
              {model.is_last_loaded
                ? t('models.detail.localState.runtimeLoaded')
                : t('models.detail.localState.runtimeIdle')}
            </p>
          </div>
        </div>

        {downloadState ? (
          <div className="bg-surface-container-low space-y-3 rounded-xl border px-4 py-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('models.detail.activeDownload')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t('models.detail.activeDownloadDescription')}
              </p>
            </div>
            <DownloadProgress state={downloadState} />
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="text-muted-foreground size-4" />
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('models.detail.sections.performance')}
          </h3>
        </div>

        <div className="space-y-5">
          <ProgressBar
            percent={rankToPercent(model.accuracy_rank)}
            label={t('models.fields.accuracy')}
            meta={t(`models.accuracyRank.${model.accuracy_rank}`)}
            valueLabel={formatModelRank(model.accuracy_rank)}
            progressClassName="h-2"
          />
          <ProgressBar
            percent={rankToPercent(model.speed_rank)}
            label={t('models.fields.speed')}
            meta={t(`models.rank.${model.speed_rank}`)}
            valueLabel={formatModelRank(model.speed_rank)}
            progressClassName="h-2"
          />
        </div>

        <p className="text-muted-foreground text-xs leading-6">
          {t('models.detail.performanceHint')}
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Info className="text-muted-foreground size-4" />
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('models.detail.sections.information')}
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
              {t('models.detail.fields.repoId')}
            </p>
            <div className="bg-surface-container-low mt-2 flex items-center gap-2 rounded-xl border px-3 py-3">
              <code className="min-w-0 flex-1 truncate text-sm font-medium">{model.repo_id}</code>
              {onCopyRepoId ? (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t('models.detail.actions.copyRepoId')}
                  onClick={() => onCopyRepoId(model.repo_id)}
                >
                  <Copy />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <Database className="size-3.5" />
              {t('models.fields.size')}
            </p>
            <p className="text-sm font-semibold">{formatMegabytes(model.size_bytes)}</p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <Database className="size-3.5" />
              {t('models.fields.diskUsage')}
            </p>
            <p className="text-sm font-semibold">
              {model.disk_usage != null
                ? formatMegabytes(model.disk_usage)
                : t('models.fields.unavailable')}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <Globe2 className="size-3.5" />
              {t('models.fields.languages')}
            </p>
            {languages.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {languages.map((language) => (
                  <span
                    key={language}
                    className="bg-surface-container-low rounded-full border px-2.5 py-1 text-xs font-medium"
                  >
                    {language}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold">{t('models.fields.unavailable')}</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <Cpu className="size-3.5" />
              {t('models.detail.fields.runtime')}
            </p>
            {/* Defer engine/backend labeling until the catalog includes more model families. */}
            <p className="text-sm font-semibold">{t('models.fields.unavailable')}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Info className="text-muted-foreground size-4" />
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('models.detail.sections.description')}
          </h3>
        </div>
        <p className="text-muted-foreground text-sm leading-7">
          {resolveModelDescription(t, model) || t('models.fields.unavailable')}
        </p>
      </section>
    </div>
  )
}
