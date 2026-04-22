import { useMemo, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useSessionTasksStore } from '@/features/tasks'
import { queryKeys } from '@/shared/lib/query-keys'
import type { TaskListResponse, TaskSummary } from '@/shared/types'

function isTaskListQueryKey(value: readonly unknown[]): boolean {
  return value[0] === queryKeys.tasks.all[0] && value[1] === queryKeys.tasks.lists()[1]
}

function buildTaskListSnapshotVersion(
  taskListSnapshots: Array<[readonly unknown[], TaskListResponse | undefined]>,
): string {
  return taskListSnapshots
    .map(([queryKey, response]) => {
      const params = queryKey[2]
      const normalizedParams =
        typeof params === 'object' && params !== null ? JSON.stringify(params) : String(params)
      const taskVersion = (response?.tasks ?? [])
        .map(
          (task) =>
            `${task.task_id}:${task.file_id}:${task.status}:${task.progress}:${task.created_at}:${task.completed_at ?? ''}:${task.filename ?? ''}`,
        )
        .join('|')
      return `${normalizedParams}:${response?.total ?? 0}:${taskVersion}`
    })
    .join('::')
}

function sortTasksNewestFirst(left: TaskSummary, right: TaskSummary): number {
  const leftTimestamp = Date.parse(left.created_at)
  const rightTimestamp = Date.parse(right.created_at)

  if (
    !Number.isNaN(leftTimestamp) &&
    !Number.isNaN(rightTimestamp) &&
    leftTimestamp !== rightTimestamp
  ) {
    return rightTimestamp - leftTimestamp
  }

  return left.task_id.localeCompare(right.task_id)
}

export function useHistoryFileAssociatedTasks(fileId: string | null): readonly TaskSummary[] {
  const queryClient = useQueryClient()
  const sessionTaskOrder = useSessionTasksStore((state) => state.order)
  const sessionTasksById = useSessionTasksStore((state) => state.byId)
  const snapshotCacheRef = useRef<{
    version: string
    snapshots: Array<[readonly unknown[], TaskListResponse | undefined]>
  }>({
    version: '',
    snapshots: [],
  })

  const taskListSnapshots = useSyncExternalStore(
    (onStoreChange) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (isTaskListQueryKey(event.query.queryKey)) {
          onStoreChange()
        }
      }),
    () => {
      const snapshots = queryClient.getQueriesData<TaskListResponse>({
        queryKey: queryKeys.tasks.lists(),
      })
      const nextVersion = buildTaskListSnapshotVersion(snapshots)

      if (snapshotCacheRef.current.version === nextVersion) {
        return snapshotCacheRef.current.snapshots
      }

      snapshotCacheRef.current = {
        version: nextVersion,
        snapshots,
      }

      return snapshots
    },
  )

  const sessionTasks = useMemo(
    () =>
      sessionTaskOrder
        .map((taskId) => sessionTasksById[taskId])
        .filter((task): task is TaskSummary => typeof task !== 'undefined'),
    [sessionTaskOrder, sessionTasksById],
  )

  return useMemo(() => {
    if (!fileId) {
      return []
    }

    const tasksById = new Map<string, TaskSummary>()

    // The files API still does not expose associated tasks. The file detail dialog can therefore
    // only surface tasks already known from cached task queries and the in-flight session store,
    // matched strictly by file_id.
    for (const [, response] of taskListSnapshots) {
      for (const task of response?.tasks ?? []) {
        if (task.file_id === fileId) {
          tasksById.set(task.task_id, task)
        }
      }
    }

    for (const task of sessionTasks) {
      if (task.file_id === fileId) {
        tasksById.set(task.task_id, task)
      }
    }

    return Array.from(tasksById.values()).sort(sortTasksNewestFirst)
  }, [fileId, sessionTasks, taskListSnapshots])
}
