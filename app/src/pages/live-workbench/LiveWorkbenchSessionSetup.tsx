import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui'

export function LiveWorkbenchSessionSetup() {
  const { t } = useTranslation()

  return (
    <Card className="gap-0 py-0" data-slot="live-workbench-session-setup">
      <CardContent className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            {t('live.workbench.sessionSetup.title')}
          </h2>
        </div>
      </CardContent>
    </Card>
  )
}
