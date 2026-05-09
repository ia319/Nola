import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2, X } from 'lucide-react'

import { Button, EmptyState } from '@/components/ui'

export interface LiveWorkbenchCompactViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LiveWorkbenchCompactView({ open, onOpenChange }: LiveWorkbenchCompactViewProps) {
  const { t } = useTranslation()
  const titleId = useId()

  if (!open) return null

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-slot="live-workbench-compact-view"
      className="bg-card text-card-foreground fixed right-6 bottom-6 z-40 flex h-[420px] w-[360px] flex-col overflow-hidden rounded-xl border shadow-lg"
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 id={titleId} className="text-foreground text-base font-semibold tracking-tight">
          {t('live.workbench.compact.title')}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('live.workbench.compact.expand')}
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <EmptyState
          title={t('live.workbench.compact.empty')}
          className="min-h-full border-0 bg-transparent px-0 py-8"
        />
      </div>
    </aside>
  )
}
