import { useTranslation } from 'react-i18next'

import { Progress } from '@/components/ui/progress'
import {
  formatMegabytes,
  formatMegabytesPerSecond,
  formatPercent,
} from '@/features/models/lib/model-helpers'
import type { DownloadState } from '@/features/models/hooks/useModelDownload'

export interface DownloadProgressProps {
  state: DownloadState
}

export function DownloadProgress({ state }: DownloadProgressProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-1.5">
      <Progress value={state.percent} className="h-2" />
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>
          {formatPercent(state.percent)}
          {state.totalBytes > 0 && (
            <>
              {' '}
              &middot; {formatMegabytes(state.downloadedBytes)} /{' '}
              {formatMegabytes(state.totalBytes)}
            </>
          )}
        </span>
        <span>
          {state.speedBps > 0
            ? formatMegabytesPerSecond(state.speedBps)
            : t('models.actions.downloading')}
        </span>
      </div>
    </div>
  )
}
