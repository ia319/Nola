import { useMemo, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useSessionTasksStore } from '@/features/tasks'
import { queryKeys } from '@/shared/lib/query-keys'
import type { TaskListResponse, TaskSummary } from '@/shared/types'

function isTaskListQueryKey(value: readonly unknown[]): boolean {
  return value[0] === queryKeys.tasks.all[0] && value[1] === queryKeys.tasks.lists()[1]
}

function appendTask(
  taskIdsByFileId: Map<string, Set<string>>,
  task: Pick<TaskSummary, 'task_id' | 'file_id'>,
) {
  const current = taskIdsByFileId.get(task.file_id) ?? new Set<string>()
  current.add(task.task_id)
  taskIdsByFileId.set(task.file_id, current)
}

function buildTaskListSnapshotVersion(
  taskListSnapshots: Array<[readonly unknown[], TaskListResponse | undefined]>,
): string {
  return taskListSnapshots
    .map(([queryKey, response]) => {
      const params = queryKey[2]
      const normalizedParams =
        typeof params === 'object' && params !== null ? JSON.stringify(params) : String(params)
      const taskIds = (response?.tasks ?? []).map((task) => task.task_id).join('|')
      return `${normalizedParams}:${response?.total ?? 0}:${taskIds}`
    })
    .join('::')
}

export function useHistoryFileTaskCounts(): ReadonlyMap<string, number> {
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
      // Reuse the previous snapshot object when cached task lists have not changed.
      // useSyncExternalStore requires a stable reference between store updates.
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
    const taskIdsByFileId = new Map<string, Set<string>>()

    // The files API does not expose associated tasks yet, so file-mode can only show counts
    // that are already known from cached task queries and the in-flight session store.
    for (const [, response] of taskListSnapshots) {
      for (const task of response?.tasks ?? []) {
        appendTask(taskIdsByFileId, task)
      }
    }

    for (const task of sessionTasks) {
      appendTask(taskIdsByFileId, task)
    }

    return new Map(
      Array.from(taskIdsByFileId.entries(), ([fileId, taskIds]) => [fileId, taskIds.size]),
    )
  }, [sessionTasks, taskListSnapshots])
}
