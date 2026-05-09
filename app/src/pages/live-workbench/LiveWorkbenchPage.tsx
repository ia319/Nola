import { useTranslation } from 'react-i18next'

import { Card, CardContent, EmptyState } from '@/components/ui'
import { ContentCanvas } from '@/layouts'

export function LiveWorkbenchPage() {
  const { t } = useTranslation()

  return (
    <ContentCanvas
      as="main"
      width="full"
      height="fill"
      className="gap-5 px-0 py-0"
      data-slot="live-workbench-page"
    >
      <h1 className="sr-only">{t('live.workbench.title')}</h1>
      <p className="sr-only">{t('live.workbench.description')}</p>

      <div
        data-slot="live-workbench-body"
        className="grid min-h-0 flex-1 gap-4 lg:grid-rows-[auto_minmax(420px,1fr)]"
      >
        <Card className="gap-0 py-0" data-slot="live-workbench-session-setup">
          <CardContent className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-foreground text-base font-semibold tracking-tight">
                {t('live.workbench.sessionSetup.title')}
              </h2>
            </div>
          </CardContent>
        </Card>

        <Card
          className="flex min-h-0 flex-col gap-0 overflow-hidden py-0"
          data-slot="live-workbench-transcript"
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="text-foreground text-base font-semibold tracking-tight">
              {t('live.workbench.transcript.title')}
            </h2>
          </div>
          <CardContent className="min-h-0 flex-1 px-0 py-0">
            <EmptyState
              title={t('live.workbench.transcript.empty')}
              className="min-h-full rounded-none border-0 bg-transparent px-5 py-10"
            />
          </CardContent>
        </Card>
      </div>
    </ContentCanvas>
  )
}
