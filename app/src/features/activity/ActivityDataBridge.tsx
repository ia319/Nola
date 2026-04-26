import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { refreshConfigCaches } from '@/config/cache-invalidation'
import logger from '@/config/logger'
import { listActiveModelDownloads, requestModelRefresh } from '@/features/models'
import type { ModelDownloadSSEPayload } from '@/features/models'
import { ACTIVE_TASK_STATUSES, isTerminalTaskStatus } from '@/features/tasks/lib/task-status-groups'
import { useTaskBoardStore } from '@/features/tasks/store/task-board-store'
import { createSSEConnection } from '@/shared/lib/sse-client'
import { queryKeys } from '@/shared/lib/query-keys'
import type { ActiveModelDownload, TaskSummary } from '@/shared/types'

import { useActivityStore } from './store'

const ACTIVE_DOWNLOADS_REFETCH_MS = 2000

function mapTasksById(tasks: TaskSummary[]): Map<string, TaskSummary> {
  return new Map(tasks.map((task) => [task.task_id, task]))
}

function isActiveTask(task: TaskSummary | undefined): boolean {
  return task ? ACTIVE_TASK_STATUSES.has(task.status) : false
}

function toActiveDownload(
  payload: ModelDownloadSSEPayload,
  previous: ActiveModelDownload | undefined,
): ActiveModelDownload {
  return {
    model_id: payload.model_id,
    name: previous?.name ?? payload.model_id,
    status: payload.status,
    percent: payload.percent,
    downloaded_bytes: payload.downloaded_bytes,
    total_bytes: payload.total_bytes,
    speed_bps: payload.speed_bps,
    error: payload.error ?? null,
  }
}

function useTaskActivitySync(): void {
  const queryClient = useQueryClient()
  const tasks = useTaskBoardStore((state) => state.tasks)
  const setActivityTasks = useActivityStore((state) => state.setTasks)
  const addRecent = useActivityStore((state) => state.addRecent)
  const previousTasksRef = useRef<Map<string, TaskSummary>>(new Map())
  const hasSeenTaskSnapshotRef = useRef(false)

  useEffect(() => {
    setActivityTasks(tasks)

    if (hasSeenTaskSnapshotRef.current) {
      let shouldInvalidateTaskLists = false

      for (const task of tasks) {
        const previous = previousTasksRef.current.get(task.task_id)
        if (!previous) continue

        if (task.status === 'completed' && isActiveTask(previous)) {
          addRecent({
            kind: 'task_completed',
            task,
            occurredAt: task.completed_at ?? undefined,
          })
        }

        if (previous.status !== task.status && isTerminalTaskStatus(task.status)) {
          shouldInvalidateTaskLists = true
        }
      }

      if (shouldInvalidateTaskLists) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
      }
    }

    previousTasksRef.current = mapTasksById(tasks)
    hasSeenTaskSnapshotRef.current = true
  }, [addRecent, queryClient, setActivityTasks, tasks])
}

function useModelActivitySync(): void {
  const queryClient = useQueryClient()
  const setModelDownloads = useActivityStore((state) => state.setModelDownloads)
  const addRecent = useActivityStore((state) => state.addRecent)
  const activeDownloadsRef = useRef<Map<string, ActiveModelDownload>>(new Map())

  const activeDownloadsQuery = useQuery({
    queryKey: queryKeys.models.downloads(),
    queryFn: ({ signal }) => listActiveModelDownloads(signal),
    refetchInterval: (query) =>
      query.state.data?.active_count ? ACTIVE_DOWNLOADS_REFETCH_MS : false,
  })

  useEffect(() => {
    const downloads = activeDownloadsQuery.data?.downloads ?? []
    activeDownloadsRef.current = new Map(downloads.map((download) => [download.model_id, download]))
    setModelDownloads(downloads)
  }, [activeDownloadsQuery.data, setModelDownloads])

  useEffect(() => {
    return createSSEConnection<ModelDownloadSSEPayload>('/api/models/events', {
      eventNames: ['progress'],
      onMessage: ({ data }) => {
        const previousDownload = activeDownloadsRef.current.get(data.model_id)
        const nextDownload = toActiveDownload(data, previousDownload)

        if (data.status === 'downloading') {
          activeDownloadsRef.current.set(data.model_id, nextDownload)
          setModelDownloads(Array.from(activeDownloadsRef.current.values()))
          return
        }

        activeDownloadsRef.current.delete(data.model_id)
        setModelDownloads(Array.from(activeDownloadsRef.current.values()))

        void queryClient.invalidateQueries({ queryKey: queryKeys.models.downloads() })
        void queryClient.invalidateQueries({ queryKey: queryKeys.models.list() })
        void queryClient.invalidateQueries({ queryKey: queryKeys.models.detail(data.model_id) })
        requestModelRefresh()

        if (data.status === 'completed') {
          addRecent({
            kind: 'model_download_completed',
            modelId: data.model_id,
            name: previousDownload?.name ?? data.model_id,
          })

          void refreshConfigCaches().catch((error: unknown) => {
            logger.error('activity.modelDownload.configRefreshFailed', {
              error,
              modelId: data.model_id,
            })
          })
        } else if (data.status === 'failed') {
          addRecent({
            kind: 'model_download_failed',
            modelId: data.model_id,
            name: previousDownload?.name ?? data.model_id,
            error: data.error ?? null,
          })
        } else if (data.status === 'cancelled') {
          addRecent({
            kind: 'model_download_cancelled',
            modelId: data.model_id,
            name: previousDownload?.name ?? data.model_id,
          })
        }
      },
      onError: (error) => {
        logger.warn('activity.modelDownload.sseFailed', { error })
      },
    })
  }, [addRecent, queryClient, setModelDownloads])
}

export function ActivityDataBridge() {
  useTaskActivitySync()
  useModelActivitySync()
  return null
}
