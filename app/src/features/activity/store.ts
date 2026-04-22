import { create } from 'zustand'

import type {
  ActiveModelDownload,
  ModelDirSource,
  ModelSettingsResponse,
  TaskStatus,
  TaskSummary,
} from '@/shared/types'

export const ACTIVITY_RECENT_LIMIT = 10

export type ActivityRouteTarget = '/history' | '/models' | '/settings/system-info'
export type ActivitySource = 'task' | 'model' | 'system'

export interface ActivityTaskRef {
  taskId: string
  fileId: string
  filename: string | null
  modelId: string | null
  status: TaskStatus
  progress: number
  createdAt: string
  completedAt: string | null
}

export interface ActivityModelRestartRef {
  configuredModelId: string | null
  lastLoadedModelId: string | null
  overrideSource: ModelDirSource
}

export interface ActivityModelDownloadRef {
  modelId: string
  name: string
  status: ActiveModelDownload['status']
  percent: number
  downloadedBytes: number
  totalBytes: number
  speedBps: number
  error: string | null
}

interface BaseActivityItem {
  id: string
  source: ActivitySource
  route: ActivityRouteTarget
  occurredAt: string
}

export interface TaskFailedActivityItem extends BaseActivityItem {
  kind: 'task_failed'
  source: 'task'
  route: '/history'
  task: ActivityTaskRef
}

export interface ModelRestartRequiredActivityItem extends BaseActivityItem {
  kind: 'model_restart_required'
  source: 'model'
  route: '/models'
  model: ActivityModelRestartRef
}

export type ActivityAttentionItem = TaskFailedActivityItem | ModelRestartRequiredActivityItem

export interface TaskInProgressActivityItem extends BaseActivityItem {
  kind: 'task_in_progress'
  source: 'task'
  route: '/history'
  task: ActivityTaskRef
}

export interface ModelDownloadInProgressActivityItem extends BaseActivityItem {
  kind: 'model_download_in_progress'
  source: 'model'
  route: '/models'
  download: ActivityModelDownloadRef
}

export type ActivityInProgressItem =
  | TaskInProgressActivityItem
  | ModelDownloadInProgressActivityItem

export interface TaskCompletedRecentInput {
  kind: 'task_completed'
  task: TaskSummary
  occurredAt?: string
}

export interface ModelDownloadCompletedRecentInput {
  kind: 'model_download_completed'
  modelId: string
  name: string
  occurredAt?: string
}

export interface ModelDownloadFailedRecentInput {
  kind: 'model_download_failed'
  modelId: string
  name: string
  error?: string | null
  occurredAt?: string
}

export interface ModelDownloadCancelledRecentInput {
  kind: 'model_download_cancelled'
  modelId: string
  name: string
  occurredAt?: string
}

export type SystemMaintenanceActivityEvent = 'file_integrity_checked' | 'orphan_cleanup_completed'

export interface SystemMaintenanceRecentInput {
  kind: 'system_maintenance_completed'
  event: SystemMaintenanceActivityEvent
  affectedCount?: number
  occurredAt?: string
}

export type ActivityRecentInput =
  | TaskCompletedRecentInput
  | ModelDownloadCompletedRecentInput
  | ModelDownloadFailedRecentInput
  | ModelDownloadCancelledRecentInput
  | SystemMaintenanceRecentInput

export interface TaskCompletedRecentActivityItem extends BaseActivityItem {
  kind: 'task_completed'
  source: 'task'
  route: '/history'
  task: ActivityTaskRef
}

export interface ModelDownloadCompletedRecentActivityItem extends BaseActivityItem {
  kind: 'model_download_completed'
  source: 'model'
  route: '/models'
  model: {
    modelId: string
    name: string
  }
}

export interface ModelDownloadFailedRecentActivityItem extends BaseActivityItem {
  kind: 'model_download_failed'
  source: 'model'
  route: '/models'
  model: {
    modelId: string
    name: string
    error: string | null
  }
}

export interface ModelDownloadCancelledRecentActivityItem extends BaseActivityItem {
  kind: 'model_download_cancelled'
  source: 'model'
  route: '/models'
  model: {
    modelId: string
    name: string
  }
}

export interface SystemMaintenanceRecentActivityItem extends BaseActivityItem {
  kind: 'system_maintenance_completed'
  source: 'system'
  route: '/settings/system-info'
  event: SystemMaintenanceActivityEvent
  affectedCount: number | null
}

export type ActivityRecentItem =
  | TaskCompletedRecentActivityItem
  | ModelDownloadCompletedRecentActivityItem
  | ModelDownloadFailedRecentActivityItem
  | ModelDownloadCancelledRecentActivityItem
  | SystemMaintenanceRecentActivityItem

export interface ActivityStoreState {
  needsAttention: ActivityAttentionItem[]
  inProgress: ActivityInProgressItem[]
  recent: ActivityRecentItem[]
  dismissedIds: Record<string, true>
  setTasks: (tasks: TaskSummary[]) => void
  setModelSettings: (settings: ModelSettingsResponse | null) => void
  setModelDownloads: (downloads: ActiveModelDownload[]) => void
  addRecent: (input: ActivityRecentInput) => void
  dismissActivity: (activityId: string) => void
  clearNeedsAttention: () => void
  clearRecent: () => void
  clearDismissed: () => void
  clearActivity: () => void
}

export function selectActivityBadgeCount(
  state: Pick<ActivityStoreState, 'needsAttention'>,
): number {
  return state.needsAttention.length
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function sortByRecency<T extends BaseActivityItem>(items: T[]): T[] {
  return items.slice().sort((a, b) => {
    const diff = toTimestamp(b.occurredAt) - toTimestamp(a.occurredAt)
    if (diff !== 0) return diff
    return b.id.localeCompare(a.id)
  })
}

function isDismissed(dismissedIds: Record<string, true>, itemId: string): boolean {
  return dismissedIds[itemId] === true
}

function nowIso(): string {
  return new Date().toISOString()
}

function toTaskRef(task: TaskSummary): ActivityTaskRef {
  return {
    taskId: task.task_id,
    fileId: task.file_id,
    filename: task.filename ?? null,
    modelId: task.model_id ?? null,
    status: task.status,
    progress: task.progress,
    createdAt: task.created_at,
    completedAt: task.completed_at,
  }
}

function createFailedTaskItem(task: TaskSummary): TaskFailedActivityItem {
  const occurredAt = task.completed_at ?? task.created_at

  return {
    id: `task:failed:${task.task_id}`,
    kind: 'task_failed',
    source: 'task',
    route: '/history',
    occurredAt,
    task: toTaskRef(task),
  }
}

function createActiveTaskItem(task: TaskSummary): TaskInProgressActivityItem {
  return {
    id: `task:in-progress:${task.task_id}`,
    kind: 'task_in_progress',
    source: 'task',
    route: '/history',
    occurredAt: task.created_at,
    task: toTaskRef(task),
  }
}

function createModelRestartItem(settings: ModelSettingsResponse): ModelRestartRequiredActivityItem {
  const modelId = settings.configured_model_id ?? settings.last_loaded_model_id ?? 'unconfigured'

  return {
    id: `model:restart-required:${modelId}`,
    kind: 'model_restart_required',
    source: 'model',
    route: '/models',
    occurredAt: nowIso(),
    model: {
      configuredModelId: settings.configured_model_id ?? null,
      lastLoadedModelId: settings.last_loaded_model_id ?? null,
      overrideSource: settings.override_source,
    },
  }
}

function createModelDownloadItem(
  download: ActiveModelDownload,
): ModelDownloadInProgressActivityItem {
  return {
    id: `model-download:in-progress:${download.model_id}`,
    kind: 'model_download_in_progress',
    source: 'model',
    route: '/models',
    occurredAt: nowIso(),
    download: {
      modelId: download.model_id,
      name: download.name,
      status: download.status,
      percent: download.percent,
      downloadedBytes: download.downloaded_bytes,
      totalBytes: download.total_bytes,
      speedBps: download.speed_bps,
      error: download.error ?? null,
    },
  }
}

function createRecentItem(input: ActivityRecentInput): ActivityRecentItem {
  const occurredAt = input.occurredAt ?? nowIso()

  if (input.kind === 'task_completed') {
    const stableTime = input.task.completed_at ?? occurredAt
    return {
      id: `recent:task-completed:${input.task.task_id}:${stableTime}`,
      kind: 'task_completed',
      source: 'task',
      route: '/history',
      occurredAt,
      task: toTaskRef(input.task),
    }
  }

  if (input.kind === 'model_download_completed') {
    return {
      id: `recent:model-download-completed:${input.modelId}:${occurredAt}`,
      kind: 'model_download_completed',
      source: 'model',
      route: '/models',
      occurredAt,
      model: {
        modelId: input.modelId,
        name: input.name,
      },
    }
  }

  if (input.kind === 'model_download_failed') {
    return {
      id: `recent:model-download-failed:${input.modelId}:${occurredAt}`,
      kind: 'model_download_failed',
      source: 'model',
      route: '/models',
      occurredAt,
      model: {
        modelId: input.modelId,
        name: input.name,
        error: input.error ?? null,
      },
    }
  }

  if (input.kind === 'model_download_cancelled') {
    return {
      id: `recent:model-download-cancelled:${input.modelId}:${occurredAt}`,
      kind: 'model_download_cancelled',
      source: 'model',
      route: '/models',
      occurredAt,
      model: {
        modelId: input.modelId,
        name: input.name,
      },
    }
  }

  return {
    id: `recent:system-maintenance:${input.event}:${occurredAt}`,
    kind: 'system_maintenance_completed',
    source: 'system',
    route: '/settings/system-info',
    occurredAt,
    event: input.event,
    affectedCount: input.affectedCount ?? null,
  }
}

function mergeGeneratedItems<T extends BaseActivityItem>(
  current: T[],
  source: ActivitySource,
  nextSourceItems: T[],
  dismissedIds: Record<string, true>,
): T[] {
  const retained = current.filter((item) => item.source !== source)
  const visibleNextItems = nextSourceItems.filter((item) => !isDismissed(dismissedIds, item.id))
  return sortByRecency([...retained, ...visibleNextItems])
}

function removeDismissedItems<T extends BaseActivityItem>(
  items: T[],
  dismissedIds: Record<string, true>,
): T[] {
  return items.filter((item) => !isDismissed(dismissedIds, item.id))
}

export const useActivityStore = create<ActivityStoreState>((set) => ({
  needsAttention: [],
  inProgress: [],
  recent: [],
  dismissedIds: {},

  setTasks: (tasks) =>
    set((state) => {
      const failedTasks = tasks.filter((task) => task.status === 'failed').map(createFailedTaskItem)
      const activeTasks = tasks
        .filter((task) => task.status === 'pending' || task.status === 'processing')
        .map(createActiveTaskItem)

      return {
        needsAttention: mergeGeneratedItems(
          state.needsAttention,
          'task',
          failedTasks,
          state.dismissedIds,
        ),
        inProgress: mergeGeneratedItems(state.inProgress, 'task', activeTasks, state.dismissedIds),
      }
    }),

  setModelSettings: (settings) =>
    set((state) => {
      const nextItems = settings?.restart_required ? [createModelRestartItem(settings)] : []

      return {
        needsAttention: mergeGeneratedItems(
          state.needsAttention,
          'model',
          nextItems,
          state.dismissedIds,
        ),
      }
    }),

  setModelDownloads: (downloads) =>
    set((state) => {
      const activeDownloads = downloads
        .filter((download) => download.status === 'downloading')
        .map(createModelDownloadItem)

      return {
        inProgress: mergeGeneratedItems(
          state.inProgress,
          'model',
          activeDownloads,
          state.dismissedIds,
        ),
      }
    }),

  addRecent: (input) =>
    set((state) => {
      const item = createRecentItem(input)
      const visibleRecent = removeDismissedItems(
        sortByRecency([item, ...state.recent.filter((entry) => entry.id !== item.id)]),
        state.dismissedIds,
      ).slice(0, ACTIVITY_RECENT_LIMIT)

      return {
        recent: visibleRecent,
      }
    }),

  dismissActivity: (activityId) =>
    set((state) => {
      const dismissedIds: Record<string, true> = {
        ...state.dismissedIds,
        [activityId]: true,
      }

      return {
        dismissedIds,
        needsAttention: removeDismissedItems(state.needsAttention, dismissedIds),
        inProgress: removeDismissedItems(state.inProgress, dismissedIds),
        recent: removeDismissedItems(state.recent, dismissedIds),
      }
    }),

  clearNeedsAttention: () =>
    set((state) => {
      const dismissedIds = { ...state.dismissedIds }
      for (const item of state.needsAttention) {
        dismissedIds[item.id] = true
      }

      return {
        dismissedIds,
        needsAttention: [],
      }
    }),

  clearRecent: () =>
    set({
      recent: [],
    }),

  clearDismissed: () =>
    set({
      dismissedIds: {},
    }),

  clearActivity: () =>
    set({
      needsAttention: [],
      inProgress: [],
      recent: [],
      dismissedIds: {},
    }),
}))
