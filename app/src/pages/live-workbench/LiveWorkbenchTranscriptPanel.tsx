import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface LiveWorkbenchTranscriptPanelProps {
  hasTranscript: boolean
  actions?: ReactNode
  className?: string
}

export function LiveWorkbenchTranscriptPanel({
  hasTranscript,
  actions,
  className,
}: LiveWorkbenchTranscriptPanelProps) {
  const { t } = useTranslation()

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

      <CardContent className="min-h-0 flex-1 px-0 py-0">
        {hasTranscript ? (
          <div data-slot="live-workbench-transcript-stream" className="min-h-full px-5 py-4" />
        ) : (
          <EmptyState
            title={t('live.workbench.transcript.empty')}
            className="min-h-full rounded-none border-0 bg-transparent px-5 py-10"
          />
        )}
      </CardContent>
    </Card>
  )
}
