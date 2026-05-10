import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AlertCircle } from 'lucide-react'

import { Button, Card, CardContent, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatLiveWorkbenchTranscriptTimeRange } from './live-workbench-formatters'
import type {
  LiveWorkbenchErrorCopy,
  LiveWorkbenchTranscriptItem,
} from './live-workbench-selectors'

const TRANSCRIPT_AUTO_SCROLL_THRESHOLD_PX = 48

export interface LiveWorkbenchTranscriptPanelProps {
  items: readonly LiveWorkbenchTranscriptItem[]
  emptyTitle?: string
  emptyDescription?: string
  errorCopy?: LiveWorkbenchErrorCopy | null
  actions?: ReactNode
  className?: string
  onRetry?: () => void
}

export function LiveWorkbenchTranscriptPanel({
  items,
  emptyTitle,
  emptyDescription,
  errorCopy,
  actions,
  className,
  onRetry,
}: LiveWorkbenchTranscriptPanelProps) {
  const { t } = useTranslation()
  const streamRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const hasTranscript = items.length > 0
  const latestItemId = items.at(-1)?.id ?? null
  const retryAction = useMemo(() => {
    if (!onRetry) return null

    return (
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t('live.workbench.errors.actions.retry')}
      </Button>
    )
  }, [onRetry, t])

  useEffect(() => {
    const stream = streamRef.current
    if (!stream || !shouldAutoScrollRef.current) return

    stream.scrollTop = stream.scrollHeight
  }, [latestItemId])

  const handleStreamScroll = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return

    const distanceFromBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom <= TRANSCRIPT_AUTO_SCROLL_THRESHOLD_PX
  }, [])

  return (
    <Card
      className={cn('flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0', className)}
      data-slot="live-workbench-transcript"
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          {t('live.workbench.transcript.title')}
        </h2>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {hasTranscript && errorCopy ? (
        <div className="border-b px-5 py-3">
          <TranscriptErrorBanner
            title={t(errorCopy.titleKey)}
            description={t(errorCopy.descriptionKey)}
          />
        </div>
      ) : null}

      <CardContent className="flex min-h-0 flex-1 px-0 py-0">
        {hasTranscript ? (
          <div
            ref={streamRef}
            data-slot="live-workbench-transcript-stream"
            className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
            onScroll={handleStreamScroll}
          >
            <ol className="space-y-2">
              {items.map((item) => (
                <TranscriptRow key={item.id} item={item} />
              ))}
            </ol>
          </div>
        ) : errorCopy ? (
          <EmptyState
            icon={<AlertCircle className="size-6" />}
            title={t(errorCopy.titleKey)}
            description={t(errorCopy.descriptionKey)}
            action={retryAction}
            className="min-h-full flex-1 justify-center rounded-none border-0 bg-transparent px-5 py-10"
          />
        ) : (
          <EmptyState
            title={emptyTitle ?? t('live.workbench.transcript.empty.title')}
            description={emptyDescription}
            className="min-h-full flex-1 justify-center rounded-none border-0 bg-transparent px-5 py-10"
          />
        )}
      </CardContent>
    </Card>
  )
}

function TranscriptRow({ item }: { item: LiveWorkbenchTranscriptItem }) {
  const { t } = useTranslation()

  return (
    <li
      data-kind={item.kind}
      className={cn(
        'border-border/70 rounded-md border px-3 py-2.5',
        item.kind === 'final' && 'bg-background',
        item.kind === 'committed_partial' && 'bg-muted/30',
        item.kind === 'preview' && 'bg-muted/20',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground tabular-nums">
          {formatLiveWorkbenchTranscriptTimeRange(item.startMs, item.endMs)}
        </span>
        <span className="text-muted-foreground">{t(`live.workbench.sources.${item.source}`)}</span>
        <span
          className={cn(
            'font-medium',
            item.kind === 'final' ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {t(`live.workbench.transcript.kind.${item.kind}`)}
        </span>
      </div>
      <p
        className={cn(
          'mt-1.5 text-sm leading-6',
          item.kind === 'final' && 'text-foreground',
          item.kind === 'committed_partial' && 'text-muted-foreground',
          item.kind === 'preview' && 'text-muted-foreground italic',
        )}
      >
        {item.text}
      </p>
    </li>
  )
}

function TranscriptErrorBanner({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5">{description}</p>
    </div>
  )
}
