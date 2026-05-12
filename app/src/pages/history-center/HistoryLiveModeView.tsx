import { Radio } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/ui/EmptyState'

export function HistoryLiveModeView() {
  const { t } = useTranslation()

  return (
    <div
      data-slot="history-live-mode-view"
      className="flex min-h-0 flex-1 items-center justify-center p-6"
    >
      <EmptyState
        icon={<Radio className="size-6" />}
        title={t('history.live.empty.title')}
        description={t('history.live.empty.description')}
      />
    </div>
  )
}
