import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface LiveWorkbenchStatusItem {
  id: string
  label: ReactNode
  value: ReactNode
}

export interface LiveWorkbenchStatusBarProps {
  items: readonly LiveWorkbenchStatusItem[]
  actions?: ReactNode
}

export function LiveWorkbenchStatusBar({ items, actions }: LiveWorkbenchStatusBarProps) {
  const { t } = useTranslation()

  return (
    <header
      data-slot="live-workbench-status-bar"
      aria-label={t('live.workbench.statusBar.region')}
      className="border-outline-variant/70 bg-background/95 flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between"
    >
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            {t('live.workbench.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('live.workbench.description')}</p>
        </div>

        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex min-w-[8rem] items-baseline gap-2">
              <dt className="text-muted-foreground shrink-0 text-xs">{item.label}</dt>
              <dd className="text-foreground min-w-0 truncate text-sm font-medium tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
