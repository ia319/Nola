import { useTranslation } from 'react-i18next'

import { ContentCanvas } from '@/layouts'
import {
  formatLiveWorkbenchCount,
  formatLiveWorkbenchEmptyValue,
} from './live-workbench-formatters'
import {
  EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS,
  selectLiveWorkbenchHasTranscript,
} from './live-workbench-selectors'
import { LiveWorkbenchCompactView } from './LiveWorkbenchCompactView'
import { LiveWorkbenchSessionSetup } from './LiveWorkbenchSessionSetup'
import { LiveWorkbenchSettingsPanel } from './LiveWorkbenchSettingsPanel'
import { LiveWorkbenchStatusBar, type LiveWorkbenchStatusItem } from './LiveWorkbenchStatusBar'
import { LiveWorkbenchTranscriptPanel } from './LiveWorkbenchTranscriptPanel'

function ignoreOpenChange() {
  return undefined
}

export function LiveWorkbenchPage() {
  const { t } = useTranslation()
  const emptyValue = formatLiveWorkbenchEmptyValue()
  const hasTranscript = selectLiveWorkbenchHasTranscript(EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS)
  const statusItems: readonly LiveWorkbenchStatusItem[] = [
    {
      id: 'session',
      label: t('live.workbench.statusBar.session'),
      value: emptyValue,
    },
    {
      id: 'duration',
      label: t('live.workbench.statusBar.duration'),
      value: emptyValue,
    },
    {
      id: 'connection',
      label: t('live.workbench.statusBar.connection'),
      value: emptyValue,
    },
    {
      id: 'tracks',
      label: t('live.workbench.statusBar.tracks'),
      value: formatLiveWorkbenchCount(0),
    },
    {
      id: 'runtime',
      label: t('live.workbench.statusBar.runtime'),
      value: emptyValue,
    },
  ]

  return (
    <ContentCanvas
      as="main"
      width="full"
      height="fill"
      className="gap-5 px-0 py-0"
      data-slot="live-workbench-page"
    >
      <div
        data-slot="live-workbench-body"
        className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(420px,1fr)] gap-4"
      >
        <LiveWorkbenchStatusBar items={statusItems} />
        <LiveWorkbenchSessionSetup />

        <div className="flex min-h-0 gap-4">
          <LiveWorkbenchTranscriptPanel hasTranscript={hasTranscript} />
          <LiveWorkbenchSettingsPanel open={false} onOpenChange={ignoreOpenChange} />
        </div>
      </div>

      <LiveWorkbenchCompactView open={false} onOpenChange={ignoreOpenChange} />
    </ContentCanvas>
  )
}
