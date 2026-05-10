import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2, Square, X } from 'lucide-react'

import { Button, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatLiveWorkbenchTranscriptTimeRange } from './live-workbench-formatters'
import type { LiveWorkbenchTranscriptItem } from './live-workbench-selectors'

export interface LiveWorkbenchCompactViewProps {
  open: boolean
  status: string
  duration: string
  items: readonly LiveWorkbenchTranscriptItem[]
  microphoneEnabled: boolean
  microphoneStatus: string
  systemAudioEnabled: boolean
  systemAudioStatus: string
  stopDisabled?: boolean
  onOpenChange: (open: boolean) => void
  onExpand?: () => void
  onStop?: () => void
}

export function LiveWorkbenchCompactView({
  open,
  status,
  duration,
  items,
  microphoneEnabled,
  microphoneStatus,
  systemAudioEnabled,
  systemAudioStatus,
  stopDisabled,
  onOpenChange,
  onExpand,
  onStop,
}: LiveWorkbenchCompactViewProps) {
  const { t } = useTranslation()
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' || event.key === 'Esc') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  function handleExpand(): void {
    onExpand?.()
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <aside
      role="region"
      aria-labelledby={titleId}
      data-slot="live-workbench-compact-view"
      className="bg-card text-card-foreground fixed right-6 bottom-6 z-40 flex h-[420px] w-[360px] flex-col overflow-hidden rounded-xl border shadow-lg"
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-foreground truncate text-base font-semibold tracking-tight"
          >
            {t('live.workbench.compact.title')}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {status} · {duration}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('live.workbench.compact.expand')}
            onClick={handleExpand}
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('live.workbench.compact.close')}
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="border-b px-5 py-3">
        <div className="grid gap-2 text-xs">
          <SourceRow
            label={t('live.workbench.sources.microphone')}
            enabled={microphoneEnabled}
            status={microphoneStatus}
          />
          <SourceRow
            label={t('live.workbench.sources.system')}
            enabled={systemAudioEnabled}
            status={systemAudioStatus}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {items.length > 0 ? (
          <ol className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="border-border/70 rounded-md border px-3 py-2">
                <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                  <span className="tabular-nums">
                    {formatLiveWorkbenchTranscriptTimeRange(item.startMs, item.endMs)}
                  </span>
                  <span>{t(`live.workbench.sources.${item.source}`)}</span>
                </div>
                <p
                  className={cn(
                    'mt-1 text-sm leading-5',
                    item.kind === 'final' ? 'text-foreground' : 'text-muted-foreground',
                    item.kind === 'preview' && 'italic',
                  )}
                >
                  {item.text}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title={t('live.workbench.compact.empty')}
            className="min-h-full border-0 bg-transparent px-0 py-8"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
        <span className="text-muted-foreground truncate text-xs">{status}</span>
        <Button type="button" variant="outline" size="sm" disabled={stopDisabled} onClick={onStop}>
          <Square className="size-4" />
          {t('live.workbench.actions.stop')}
        </Button>
      </div>
    </aside>
  )
}

function SourceRow({
  label,
  enabled,
  status,
}: {
  label: string
  enabled: boolean
  status: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="text-foreground truncate font-medium">{label}</span>
      <span
        className={cn('truncate', enabled ? 'text-muted-foreground' : 'text-muted-foreground/70')}
      >
        {status}
      </span>
    </div>
  )
}
