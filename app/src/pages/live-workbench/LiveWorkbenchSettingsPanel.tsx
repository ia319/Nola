import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/ui'
import { WorkspaceSidePanel } from '@/layouts'

export interface LiveWorkbenchSettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LiveWorkbenchSettingsPanel({
  open,
  onOpenChange,
}: LiveWorkbenchSettingsPanelProps) {
  const { t } = useTranslation()

  return (
    <WorkspaceSidePanel
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={t('live.workbench.settings.eyebrow')}
      title={t('live.workbench.settings.title')}
      description={t('live.workbench.settings.description')}
    >
      <EmptyState
        title={t('live.workbench.settings.empty.title')}
        description={t('live.workbench.settings.empty.description')}
        className="border-0 bg-transparent px-0 py-6"
      />
    </WorkspaceSidePanel>
  )
}
