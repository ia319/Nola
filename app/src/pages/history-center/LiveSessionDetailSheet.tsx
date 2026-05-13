import { Copy } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DetailSheet } from '@/components/ui/DetailSheet'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { AppError, LiveSessionDetail, LiveSessionSummary, TaskStatus } from '@/shared/types'

const LazyLiveSessionDetailContent = lazy(async () => {
  const module = await import('./LiveSessionDetailContent')
  return { default: module.LiveSessionDetailContent }
})

export interface LiveSessionDetailSheetProps {
  open: boolean
  summarySession: LiveSessionSummary | null
  detailSession: LiveSessionDetail | null
  error: AppError | null
  onOpenChange: (open: boolean) => void
}

function mapLiveStatusToBadgeStatus(status: LiveSessionSummary['status']): TaskStatus {
  if (status === 'active') return 'processing'
  if (status === 'finished') return 'completed'
  return 'failed'
}

export function LiveSessionDetailSheet({
  open,
  summarySession,
  detailSession,
  error,
  onOpenChange,
}: LiveSessionDetailSheetProps) {
  const { t } = useTranslation()
  const displaySession = detailSession ?? summarySession

  async function handleCopySessionId(sessionId: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      toast.error(t('history.live.toast.actionFailed'))
      return
    }

    try {
      await navigator.clipboard.writeText(sessionId)
      toast.success(t('history.live.detail.toast.sessionIdCopied'))
    } catch {
      toast.error(t('history.live.toast.actionFailed'))
    }
  }

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      mode="dialog"
      size="wide"
      eyebrow={t('history.live.detail.eyebrow')}
      title={displaySession?.title?.trim() || t('history.live.table.titleFallback')}
      description={
        displaySession ? (
          <span className="font-mono text-xs tracking-tight">
            {t('history.live.detail.fields.sessionId')}: {displaySession.session_id}
          </span>
        ) : undefined
      }
      headerAdornment={
        displaySession ? (
          <div className="flex items-center gap-2">
            <StatusBadge
              status={mapLiveStatusToBadgeStatus(displaySession.status)}
              label={t(`history.live.status.${displaySession.status}`)}
            />
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={t('history.live.detail.copySessionId')}
              onClick={() => {
                void handleCopySessionId(displaySession.session_id)
              }}
            >
              <Copy />
            </Button>
          </div>
        ) : undefined
      }
      closeLabel={t('history.live.detail.close')}
      bodyClassName="px-0 py-0"
    >
      {error ? (
        <div className="px-6 py-8">
          <p className="text-destructive text-sm">{t(error.i18nKey, error.params ?? {})}</p>
        </div>
      ) : detailSession ? (
        <Suspense
          fallback={
            <div className="px-6 py-8">
              <p className="text-muted-foreground text-sm">{t('history.live.detail.loading')}</p>
            </div>
          }
        >
          <LazyLiveSessionDetailContent session={detailSession} />
        </Suspense>
      ) : (
        <div className="px-6 py-8">
          <p className="text-muted-foreground text-sm">{t('history.live.detail.loading')}</p>
        </div>
      )}
    </DetailSheet>
  )
}
