import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { JsonPropertiesBlock } from '@/components/common/JsonPropertiesBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatMillisecondsClockRange } from '@/shared/lib/time-format'
import type { LiveSegment, LiveSessionDetail } from '@/shared/types'

export interface LiveSessionDetailContentProps {
  session: LiveSessionDetail
}

function formatTimestamp(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function formatOptionalValue(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback
}

function buildSegmentRange(segment: LiveSegment): string {
  return `[${formatMillisecondsClockRange(segment.start_ms, segment.end_ms)}]`
}

export function LiveSessionDetailContent({ session }: LiveSessionDetailContentProps) {
  const { t } = useTranslation()
  const segments = session.segments ?? []
  const finalSegments = segments.filter((segment) => segment.is_final)
  const unavailable = t('history.live.detail.fields.unavailable')

  return (
    <div
      data-slot="live-session-detail-content"
      className="grid min-h-0 gap-0 lg:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]"
    >
      <section className="min-h-0 border-b lg:border-r lg:border-b-0">
        <div className="border-b px-6 py-4">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.live.detail.sections.transcriptionResult')}
          </h3>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-6">
          {finalSegments.length > 0 ? (
            finalSegments.map((segment) => (
              <article
                key={segment.segment_id}
                className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]"
              >
                <div className="text-muted-foreground font-mono text-xs font-medium tracking-tight">
                  {buildSegmentRange(segment)}
                </div>
                <p className="text-sm leading-7 whitespace-pre-wrap">{segment.text}</p>
              </article>
            ))
          ) : (
            <EmptyState
              icon={<FileText className="size-6" />}
              title={t('history.live.detail.segments.empty.title')}
              description={t('history.live.detail.segments.empty.description')}
            />
          )}
        </div>
      </section>

      <aside className="bg-surface-container-low/40 min-h-0 space-y-6 px-6 py-6">
        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.live.detail.sections.sessionMetadata')}
          </h3>

          <dl className="space-y-4">
            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.live.detail.fields.status')}
              </dt>
              <dd className="text-sm font-medium">{t(`history.live.status.${session.status}`)}</dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.live.detail.fields.mode')}
              </dt>
              <dd className="text-sm font-medium">
                {t(`history.live.detail.mode.${session.mode}`)}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.live.detail.fields.startedAt')}
              </dt>
              <dd className="text-sm font-medium">
                {formatTimestamp(session.started_at, unavailable)}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.live.detail.fields.endedAt')}
              </dt>
              <dd className="text-sm font-medium">
                {formatTimestamp(session.ended_at, unavailable)}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.live.detail.fields.languageHint')}
              </dt>
              <dd className="font-mono text-sm font-medium tracking-tight">
                {formatOptionalValue(session.language_hint, unavailable)}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.live.detail.fields.model')}
              </dt>
              <dd className="font-mono text-sm font-medium tracking-tight">
                {formatOptionalValue(session.model_id, t('history.table.modelFallback'))}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.live.detail.fields.runtime')}
              </dt>
              <dd className="font-mono text-sm font-medium tracking-tight">
                {formatOptionalValue(session.runtime, unavailable)}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t('history.live.detail.fields.audioFormat')}
              </dt>
              <dd className="font-mono text-sm font-medium tracking-tight">
                {formatOptionalValue(session.audio_format, unavailable)}
              </dd>
            </div>

            {session.error ? (
              <div className="space-y-1">
                <dt className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                  {t('history.live.detail.fields.error')}
                </dt>
                <dd className="text-destructive text-sm font-medium">{session.error}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase">
            {t('history.live.detail.sections.technicalProperties')}
          </h3>

          <JsonPropertiesBlock
            value={session.request_overrides}
            title={t('history.requestParameters.title')}
            emptyTitle={t('history.requestParameters.unavailable.title')}
            emptyDescription={t('history.requestParameters.unavailable.description')}
          />
        </section>
      </aside>
    </div>
  )
}
