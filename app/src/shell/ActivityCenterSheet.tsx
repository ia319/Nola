import type { ReactNode } from 'react'

import { AlertTriangle, BellDot, CheckCircle2, Download, RotateCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, DetailSheet, ProgressBar, StatusBadge } from '@/components/ui'
import type {
  ActivityAttentionItem,
  ActivityInProgressItem,
  ActivityModelRestartRef,
  ActivityRecentItem,
  ActivityRouteTarget,
} from '@/features/activity'
import { selectActivityBadgeCount, useActivityStore } from '@/features/activity'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/shared/lib/format'

export interface ActivityCenterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (route: ActivityRouteTarget) => void
}

const ACTIVITY_ROUTE_LABEL_KEYS: Record<ActivityRouteTarget, string> = {
  '/history': 'shell.activityCenter.route.history',
  '/models': 'shell.activityCenter.route.models',
  '/settings/system-info': 'shell.activityCenter.route.systemInfo',
}

const MODEL_OVERRIDE_SOURCE_LABEL_KEYS: Record<ActivityModelRestartRef['overrideSource'], string> =
  {
    database: 'settings.modelStorage.values.overrideSource.database',
    default: 'settings.modelStorage.values.overrideSource.default',
    environment: 'settings.modelStorage.values.overrideSource.environment',
  }

interface ActivitySectionProps {
  title: ReactNode
  count?: number
  isLive?: boolean
  action?: ReactNode
  children: ReactNode
}

function ActivitySection({ title, count, isLive = false, action, children }: ActivitySectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-foreground truncate text-[10px] font-black tracking-[0.15em] uppercase">
            {title}
          </h3>
          {typeof count === 'number' ? (
            <span
              className={cn(
                'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold',
                count > 0
                  ? 'border-destructive/20 bg-destructive-container text-on-destructive-container border'
                  : 'bg-surface-container-high text-muted-foreground',
              )}
            >
              {count}
            </span>
          ) : null}
          {isLive ? (
            <span className="bg-muted-foreground size-2 animate-pulse rounded-full" />
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyActivityBlock({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <div className="border-border/80 bg-surface-container-lowest rounded-lg border border-dashed px-4 py-5">
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{description}</p>
    </div>
  )
}

function RouteButton({
  route,
  onNavigate,
}: {
  route: ActivityRouteTarget
  onNavigate: (route: ActivityRouteTarget) => void
}) {
  const { t } = useTranslation()
  const label = t(ACTIVITY_ROUTE_LABEL_KEYS[route])

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="bg-surface-container-low text-muted-foreground hover:text-foreground h-6 rounded-full px-2 text-[10px] font-bold tracking-[0.12em] uppercase"
      aria-label={t('shell.activityCenter.actions.openRoute', { route: label })}
      onClick={() => onNavigate(route)}
    >
      {label}
    </Button>
  )
}

function DismissButton({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  const { t } = useTranslation()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={t('shell.activityCenter.actions.dismiss', { label })}
      onClick={onDismiss}
    >
      <X className="size-3" />
    </Button>
  )
}

function formatTaskIdentity(
  item: ActivityAttentionItem | ActivityInProgressItem | ActivityRecentItem,
): string | null {
  if (!('task' in item)) return null

  return item.task.filename?.trim() || item.task.taskId
}

function AttentionItemCard({
  item,
  onDismiss,
  onNavigate,
}: {
  item: ActivityAttentionItem
  onDismiss: (activityId: string) => void
  onNavigate: (route: ActivityRouteTarget) => void
}) {
  const { t } = useTranslation()

  if (item.kind === 'task_failed') {
    const title = t('shell.activityCenter.items.failedTask')
    const identity = formatTaskIdentity(item)

    return (
      <div className="bg-destructive-container/25 border-destructive/15 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-destructive mt-0.5 size-5" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-foreground text-sm font-bold">{title}</p>
                <p className="text-muted-foreground truncate font-mono text-xs">{identity}</p>
              </div>
              <DismissButton label={title} onDismiss={() => onDismiss(item.id)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={item.task.status} />
              <RouteButton route={item.route} onNavigate={onNavigate} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const title = t('shell.activityCenter.items.restartRequired')
  const modelId =
    item.model.configuredModelId ??
    item.model.lastLoadedModelId ??
    t('settings.modelStorage.values.empty')

  return (
    <div className="bg-warning-container/30 border-warning/15 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <RotateCw className="text-warning mt-0.5 size-5" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-foreground text-sm font-bold">{title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {t('shell.activityCenter.items.configuredModel', { modelId })}
              </p>
            </div>
            <DismissButton label={title} onDismiss={() => onDismiss(item.id)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-xs">
              {t(MODEL_OVERRIDE_SOURCE_LABEL_KEYS[item.model.overrideSource])}
            </span>
            <RouteButton route={item.route} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InProgressItemCard({
  item,
  onNavigate,
}: {
  item: ActivityInProgressItem
  onNavigate: (route: ActivityRouteTarget) => void
}) {
  const { t } = useTranslation()

  if (item.kind === 'task_in_progress') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-foreground truncate text-sm font-bold">
            {formatTaskIdentity(item) ?? t('shell.activityCenter.items.taskInProgress')}
          </p>
          <StatusBadge status={item.task.status} />
        </div>
        <ProgressBar
          percent={item.task.progress}
          showValue
          label={t('shell.activityCenter.items.taskInProgress')}
          meta={<RouteButton route={item.route} onNavigate={onNavigate} />}
        />
      </div>
    )
  }

  const speed = `${formatFileSize(item.download.speedBps)}/s`
  const transfer = `${formatFileSize(item.download.downloadedBytes)} / ${formatFileSize(
    item.download.totalBytes,
  )}`

  return (
    <div className="bg-surface-container-lowest rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Download className="text-muted-foreground mt-0.5 size-5" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-foreground text-sm font-bold">
              {t('shell.activityCenter.items.modelDownload')}
            </p>
            <p className="text-muted-foreground truncate font-mono text-xs">{item.download.name}</p>
          </div>
          <ProgressBar
            percent={item.download.percent}
            label={speed}
            meta={transfer}
            valueLabel={`${Math.round(item.download.percent)}%`}
          />
          <div className="flex justify-end">
            <RouteButton route={item.route} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </div>
  )
}

function RecentItemRow({
  item,
  onDismiss,
  onNavigate,
}: {
  item: ActivityRecentItem
  onDismiss: (activityId: string) => void
  onNavigate: (route: ActivityRouteTarget) => void
}) {
  const { t } = useTranslation()

  let title: string
  let detail: string
  let icon: ReactNode = <CheckCircle2 className="size-4" />

  if (item.kind === 'task_completed') {
    title = t('shell.activityCenter.items.taskCompleted')
    detail =
      formatTaskIdentity(item) ??
      t('shell.activityCenter.items.taskId', { taskId: item.task.taskId })
  } else if (item.kind === 'model_download_completed') {
    title = t('shell.activityCenter.items.modelDownloadCompleted')
    detail = item.model.name
    icon = <Download className="size-4" />
  } else if (item.kind === 'model_download_failed') {
    title = t('shell.activityCenter.items.modelDownloadFailed')
    detail = item.model.error?.trim() || item.model.name
    icon = <AlertTriangle className="size-4" />
  } else if (item.kind === 'model_download_cancelled') {
    title = t('shell.activityCenter.items.modelDownloadCancelled')
    detail = item.model.name
    icon = <Download className="size-4" />
  } else {
    title =
      item.event === 'file_integrity_checked'
        ? t('shell.activityCenter.items.fileIntegrityChecked')
        : t('shell.activityCenter.items.orphanCleanupCompleted')
    detail =
      item.affectedCount == null
        ? t('shell.activityCenter.route.systemInfo')
        : t('shell.activityCenter.items.affectedCount', { count: item.affectedCount })
    icon = <BellDot className="size-4" />
  }

  return (
    <div className="flex gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-foreground truncate text-xs font-bold">{title}</p>
            <p className="text-muted-foreground truncate text-[11px]">{detail}</p>
          </div>
          <DismissButton label={title} onDismiss={() => onDismiss(item.id)} />
        </div>
        <div className="mt-2">
          <RouteButton route={item.route} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  )
}

export function ActivityCenterSheet({ open, onOpenChange, onNavigate }: ActivityCenterSheetProps) {
  const { t } = useTranslation()
  const needsAttention = useActivityStore((state) => state.needsAttention)
  const inProgress = useActivityStore((state) => state.inProgress)
  const recent = useActivityStore((state) => state.recent)
  const badgeCount = useActivityStore(selectActivityBadgeCount)
  const dismissActivity = useActivityStore((state) => state.dismissActivity)
  const clearNeedsAttention = useActivityStore((state) => state.clearNeedsAttention)
  const clearRecent = useActivityStore((state) => state.clearRecent)

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      mode="sheet"
      title={t('shell.activityCenter.title')}
      description={t('shell.activityCenter.description')}
      closeLabel={t('shell.activityCenter.close')}
      className="w-[400px] max-w-[400px]"
      bodyClassName="space-y-8"
      footer={
        <Button
          type="button"
          className="w-full"
          disabled={recent.length === 0}
          onClick={clearRecent}
        >
          {t('shell.activityCenter.actions.clearRecent')}
        </Button>
      }
    >
      <ActivitySection
        title={t('shell.activityCenter.sections.needsAttention')}
        count={badgeCount}
        action={
          needsAttention.length > 0 ? (
            <Button type="button" variant="ghost" size="xs" onClick={clearNeedsAttention}>
              {t('shell.activityCenter.actions.dismissAll')}
            </Button>
          ) : null
        }
      >
        {needsAttention.length > 0 ? (
          <div className="space-y-3">
            {needsAttention.map((item) => (
              <AttentionItemCard
                key={item.id}
                item={item}
                onDismiss={dismissActivity}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <EmptyActivityBlock
            title={t('shell.activityCenter.empty.needsAttention.title')}
            description={t('shell.activityCenter.empty.needsAttention.description')}
          />
        )}
      </ActivitySection>

      <ActivitySection title={t('shell.activityCenter.sections.inProgress')} isLive>
        {inProgress.length > 0 ? (
          <div className="space-y-4">
            {inProgress.map((item) => (
              <InProgressItemCard key={item.id} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ) : (
          <EmptyActivityBlock
            title={t('shell.activityCenter.empty.inProgress.title')}
            description={t('shell.activityCenter.empty.inProgress.description')}
          />
        )}
      </ActivitySection>

      <ActivitySection title={t('shell.activityCenter.sections.recent')}>
        {recent.length > 0 ? (
          <div className="space-y-4">
            {recent.map((item) => (
              <RecentItemRow
                key={item.id}
                item={item}
                onDismiss={dismissActivity}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <EmptyActivityBlock
            title={t('shell.activityCenter.empty.recent.title')}
            description={t('shell.activityCenter.empty.recent.description')}
          />
        )}
      </ActivitySection>
    </DetailSheet>
  )
}
