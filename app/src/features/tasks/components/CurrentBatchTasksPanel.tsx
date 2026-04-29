import { useCallback, useMemo, useRef, useState } from 'react'
import { Download, ListTodo, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  InteractiveTable,
  InteractiveTableFilterBar,
  InteractiveTablePagination,
  InteractiveTableRowActionsMenu,
  useInteractiveTableSelection,
  type InteractiveBatchAction,
  type InteractiveSortState,
  type InteractiveTableColumn,
  type InteractiveTableRowAction,
} from '@/components/common'
import type { TaskActionHandler } from '@/components/common'
import {
  Button,
  EmptyState,
  Input,
  ProgressBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from '@/components/ui'
import logger from '@/config/logger'
import {
  useRecentTaskQuery,
  type RecentTaskSortBy,
} from '@/features/tasks/hooks/useRecentTaskQuery'
import { useSessionTasksStore } from '@/features/tasks/store/session-tasks-store'
import {
  DEFAULT_TASK_FILTER_STATUS,
  TASK_FILTER_STATUS_OPTIONS,
} from '@/shared/lib/task-query-options'
import {
  isActiveTaskStatus,
  isDeletableTaskRecordStatus,
  isExportableTaskStatus,
  isRetryableTaskStatus,
} from '@/shared/lib/task-status'
import type { BatchTaskActionResponse, TaskFilterStatus, TaskSummary } from '@/shared/types'

type TaskActionType = 'cancel' | 'delete' | 'export' | 'retry'
type BatchTaskHandler = (taskIds: string[]) => Promise<void | BatchTaskActionResponse>

export interface CurrentBatchTasksPanelProps {
  title?: string
  description?: string
  emptyText?: string
  resolveFileName?: (task: TaskSummary) => string | undefined
  onCancelTask?: TaskActionHandler
  onRetryTask?: TaskActionHandler
  onDeleteTaskRecord?: TaskActionHandler
  onExportTask?: TaskActionHandler
  onBatchCancelTasks?: BatchTaskHandler
  onBatchRetryTasks?: BatchTaskHandler
  onOpenTaskDetail?: (task: TaskSummary) => void
  pageSize?: number
}

function formatDatetime(value: string | null): string {
  if (!value) return '-'
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function resolveFileLabel(
  task: TaskSummary,
  resolveFileName?: (task: TaskSummary) => string | undefined,
): string {
  return task.filename?.trim() || resolveFileName?.(task)?.trim() || task.file_id
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  if (progress <= 0) return 0
  if (progress >= 100) return 100
  return progress
}

function canCancelTask(task: TaskSummary): boolean {
  return isActiveTaskStatus(task.status)
}

function canRetryTask(task: TaskSummary): boolean {
  return isRetryableTaskStatus(task.status)
}

function canDeleteTaskRecord(task: TaskSummary): boolean {
  return isDeletableTaskRecordStatus(task.status)
}

export function CurrentBatchTasksPanel({
  title,
  description,
  emptyText,
  resolveFileName,
  onCancelTask,
  onRetryTask,
  onDeleteTaskRecord,
  onExportTask,
  onBatchCancelTasks,
  onBatchRetryTasks,
  onOpenTaskDetail,
  pageSize,
}: CurrentBatchTasksPanelProps) {
  const { t } = useTranslation()
  const [runningBatchAction, setRunningBatchAction] = useState<'cancel' | 'retry' | null>(null)
  const runningBatchActionRef = useRef(false)
  const runningRowActionsRef = useRef<Map<string, TaskActionType>>(new Map())
  const [runningRowActions, setRunningRowActions] = useState<Map<string, TaskActionType>>(
    () => new Map(),
  )

  // NOTE: Keep selectors independent to avoid object-identity churn from composed selectors;
  // consolidate only after profiling shows re-render pressure in this panel.
  const order = useSessionTasksStore((state) => state.order)
  const byId = useSessionTasksStore((state) => state.byId)

  const tasks = useMemo(() => {
    return order.map((taskId) => byId[taskId]).filter((task): task is TaskSummary => Boolean(task))
  }, [byId, order])
  const hasActiveTasks = tasks.some(canCancelTask)
  const getTaskFileLabel = useCallback(
    (task: TaskSummary) => resolveFileLabel(task, resolveFileName),
    [resolveFileName],
  )

  const {
    query,
    tasks: pagedTasks,
    total,
    totalPages,
    newTaskCount,
    setSearch,
    setStatus,
    setSortBy,
    setOrder,
    setPage,
    goToFirstPageForNewTasks,
  } = useRecentTaskQuery(tasks, pageSize, { getFileLabel: getTaskFileLabel })

  const pagedTaskMap = useMemo(() => {
    return Object.fromEntries(pagedTasks.map((task) => [task.task_id, task]))
  }, [pagedTasks])

  const selectionResetToken = `${query.order}|${query.page}|${query.q}|${query.sort_by}|${query.status}`
  const tableSelection = useInteractiveTableSelection({
    rows: pagedTasks,
    getRowId: (task) => task.task_id,
    resetToken: selectionResetToken,
  })

  const sort = useMemo<InteractiveSortState<RecentTaskSortBy>>(
    () => ({
      key: query.sort_by,
      direction: query.order,
    }),
    [query.order, query.sort_by],
  )

  function markRowActionRunning(taskId: string, action: TaskActionType): boolean {
    if (runningRowActionsRef.current.has(taskId)) {
      return false
    }

    runningRowActionsRef.current.set(taskId, action)
    setRunningRowActions((previous) => {
      if (previous.has(taskId)) {
        return previous
      }
      const next = new Map(previous)
      next.set(taskId, action)
      return next
    })
    return true
  }

  function clearRowActionRunning(taskId: string, action: TaskActionType): void {
    if (runningRowActionsRef.current.get(taskId) !== action) {
      return
    }

    runningRowActionsRef.current.delete(taskId)
    setRunningRowActions((previous) => {
      if (previous.get(taskId) !== action) {
        return previous
      }
      const next = new Map(previous)
      next.delete(taskId)
      return next
    })
  }

  async function runPerTaskAction(taskIds: string[], handler?: TaskActionHandler): Promise<void> {
    if (!handler || taskIds.length === 0) {
      return
    }

    for (const taskId of taskIds) {
      const task = pagedTaskMap[taskId]
      if (!task) {
        continue
      }
      await handler(task)
    }
  }

  async function runBatchAction(action: 'cancel' | 'retry', targetRows: readonly TaskSummary[]) {
    const taskIds = targetRows.map((task) => task.task_id)
    if (taskIds.length === 0 || runningBatchActionRef.current) {
      return
    }

    const batchHandler = action === 'cancel' ? onBatchCancelTasks : onBatchRetryTasks
    const perTaskHandler = action === 'cancel' ? onCancelTask : onRetryTask
    if (!batchHandler && !perTaskHandler) {
      return
    }

    runningBatchActionRef.current = true
    setRunningBatchAction(action)
    try {
      if (batchHandler) {
        await batchHandler(taskIds)
      } else {
        await runPerTaskAction(taskIds, perTaskHandler)
      }
      tableSelection.onClearSelection()
    } catch {
      return
    } finally {
      runningBatchActionRef.current = false
      setRunningBatchAction(null)
    }
  }

  async function runRowAction(
    task: TaskSummary,
    action: TaskActionType,
    handler: TaskActionHandler,
  ): Promise<void> {
    if (!markRowActionRunning(task.task_id, action)) {
      return
    }

    try {
      await handler(task)
    } catch (error: unknown) {
      logger.error('tasks.currentBatch.rowActionFailed', {
        taskId: task.task_id,
        action,
        error,
      })
    } finally {
      clearRowActionRunning(task.task_id, action)
    }
  }

  const hasBatchCancelHandler = Boolean(onBatchCancelTasks || onCancelTask)
  const hasBatchRetryHandler = Boolean(onBatchRetryTasks || onRetryTask)

  const batchActions: InteractiveBatchAction<TaskSummary>[] = []

  if (hasBatchCancelHandler) {
    batchActions.push({
      id: 'cancel',
      label: t('tasks.actions.cancel'),
      icon: <X />,
      getEligibleRows: (selectedRows) => selectedRows.filter(canCancelTask),
      run: (selectedRows) => runBatchAction('cancel', selectedRows),
      disabled: runningBatchAction !== null,
      isRunning: runningBatchAction === 'cancel',
    })
  }

  if (hasBatchRetryHandler) {
    batchActions.push({
      id: 'retry',
      label: t('tasks.actions.retry'),
      icon: <RotateCcw />,
      getEligibleRows: (selectedRows) => selectedRows.filter(canRetryTask),
      run: (selectedRows) => runBatchAction('retry', selectedRows),
      disabled: runningBatchAction !== null,
      isRunning: runningBatchAction === 'retry',
    })
  }

  const columns: readonly InteractiveTableColumn<TaskSummary, RecentTaskSortBy>[] = (() => {
    function buildRowActions(task: TaskSummary): readonly InteractiveTableRowAction[] {
      const rowRunningAction = runningRowActions.get(task.task_id) ?? null
      const rowBusy = rowRunningAction !== null
      const cancelBusy = rowRunningAction === 'cancel'
      const retryBusy = rowRunningAction === 'retry'
      const exportBusy = rowRunningAction === 'export'
      const deleteBusy = rowRunningAction === 'delete'

      return [
        {
          id: 'cancel',
          label: cancelBusy ? t('tasks.actions.cancelling') : t('tasks.actions.cancel'),
          icon: <X />,
          hidden: !canCancelTask(task) || !hasBatchCancelHandler,
          disabled: rowBusy || runningBatchAction !== null,
          run: () => {
            if (onCancelTask) {
              return runRowAction(task, 'cancel', onCancelTask)
            }
            return runBatchAction('cancel', [task])
          },
        },
        {
          id: 'retry',
          label: retryBusy ? t('tasks.actions.retrying') : t('tasks.actions.retry'),
          icon: <RotateCcw />,
          hidden: !canRetryTask(task) || !hasBatchRetryHandler,
          disabled: rowBusy || runningBatchAction !== null,
          run: () => {
            if (onRetryTask) {
              return runRowAction(task, 'retry', onRetryTask)
            }
            return runBatchAction('retry', [task])
          },
        },
        {
          id: 'export',
          label: exportBusy ? t('tasks.actions.exporting') : t('tasks.actions.export'),
          icon: <Download />,
          hidden: !isExportableTaskStatus(task.status) || !onExportTask,
          disabled: rowBusy || runningBatchAction !== null,
          run: () => (onExportTask ? runRowAction(task, 'export', onExportTask) : undefined),
        },
        {
          id: 'delete',
          label: deleteBusy ? t('tasks.actions.deleting') : t('tasks.actions.deleteRecord'),
          icon: <Trash2 />,
          hidden: !canDeleteTaskRecord(task) || !onDeleteTaskRecord,
          disabled: rowBusy || runningBatchAction !== null,
          variant: 'destructive',
          run: () =>
            onDeleteTaskRecord ? runRowAction(task, 'delete', onDeleteTaskRecord) : undefined,
        },
      ]
    }

    return [
      {
        id: 'task',
        header: t('tasks.fields.taskId'),
        sortKey: 'task_id',
        className: 'min-w-[220px]',
        cell: (task) => (
          <span className="font-mono text-xs font-medium tracking-tight">{task.task_id}</span>
        ),
      },
      {
        id: 'filename',
        header: t('tasks.workbench.sections.activity.columns.filename'),
        sortKey: 'filename',
        className: 'min-w-[280px]',
        cell: (task) => (
          <div className="min-w-0 space-y-1">
            <p className="text-foreground truncate text-sm font-medium">
              {resolveFileLabel(task, resolveFileName)}
            </p>
            <p className="text-muted-foreground truncate font-mono text-xs tracking-tight">
              {task.file_id}
            </p>
          </div>
        ),
      },
      {
        id: 'status',
        header: t('tasks.fields.status'),
        sortKey: 'status',
        className: 'w-[140px] min-w-[140px]',
        cell: (task) => <StatusBadge status={task.status} />,
      },
      {
        id: 'progress',
        header: t('tasks.fields.progress'),
        sortKey: 'progress',
        defaultSortDirection: 'desc',
        className: 'w-[240px] min-w-[220px]',
        cell: (task) => {
          const progress = clampProgress(task.progress)

          return (
            <div className="flex min-w-[12rem] items-center gap-3">
              <div className="min-w-0 flex-1">
                <ProgressBar
                  percent={progress}
                  showValue={false}
                  className="space-y-0"
                  progressClassName="h-1.5"
                />
              </div>
              <span className="text-foreground min-w-11 text-right text-xs font-medium tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
          )
        },
      },
      {
        id: 'created',
        header: t('tasks.fields.createdAt'),
        sortKey: 'created_at',
        defaultSortDirection: 'desc',
        className: 'w-[190px] min-w-[190px]',
        cell: (task) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {formatDatetime(task.created_at)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('tasks.workbench.sections.activity.columns.action'),
        headerClassName: 'text-right',
        className: 'w-16 text-right',
        cell: (task) => (
          <InteractiveTableRowActionsMenu
            actions={buildRowActions(task)}
            triggerLabel={t('tasks.currentBatch.table.rowActions', { taskId: task.task_id })}
          />
        ),
      },
    ]
  })()

  return (
    <section data-slot="current-batch-tasks-panel" className="space-y-3">
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b pb-2">
        <div className="space-y-1">
          <h2 className="text-foreground text-base font-semibold tracking-tight uppercase">
            {title ?? t('tasks.currentBatch.title')}
          </h2>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : (
            <p className="text-muted-foreground text-sm">{t('tasks.currentBatch.description')}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={[
              'inline-flex size-2 rounded-full',
              hasActiveTasks ? 'bg-foreground animate-pulse' : 'bg-muted-foreground/35',
            ].join(' ')}
          />
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
            {hasActiveTasks
              ? t('tasks.workbench.sections.activity.state.active')
              : t('tasks.workbench.sections.activity.state.idle')}
          </span>
        </div>
      </div>

      <InteractiveTable
        caption={t('tasks.workbench.sections.activity.caption')}
        rows={pagedTasks}
        getRowId={(task) => task.task_id}
        columns={columns}
        sort={sort}
        onSortChange={(nextSort) => {
          setSortBy(nextSort.key)
          setOrder(nextSort.direction)
        }}
        filters={
          <div className="space-y-2">
            {newTaskCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('tasks.currentBatch.newTasksNotice', { count: newTaskCount })}
                </p>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={goToFirstPageForNewTasks}
                >
                  {t('tasks.currentBatch.backToFirstPage')}
                </Button>
              </div>
            ) : null}

            <InteractiveTableFilterBar
              leading={
                <>
                  <label className="relative block w-full max-w-md min-w-[220px] flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                      value={query.q}
                      aria-label={t('tasks.filters.searchPlaceholder')}
                      placeholder={t('tasks.filters.searchPlaceholder')}
                      className="bg-background pr-9 pl-9"
                      onChange={(event) => {
                        setSearch(event.target.value)
                      }}
                    />
                    {query.q ? (
                      <button
                        type="button"
                        aria-label={t('tasks.currentBatch.filters.clearSearch')}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        onClick={() => {
                          setSearch('')
                        }}
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    ) : null}
                  </label>

                  <Select
                    value={query.status}
                    onValueChange={(value) => {
                      setStatus(value as TaskFilterStatus)
                    }}
                  >
                    <SelectTrigger className="w-[160px]" aria-label={t('tasks.fields.status')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_FILTER_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === DEFAULT_TASK_FILTER_STATUS
                            ? t('tasks.filters.statusAll')
                            : t(`tasks.status.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
            />
          </div>
        }
        selection={{
          ...tableSelection.selection,
          getRowLabel: (task) => t('tasks.selection.selectTask', { taskId: task.task_id }),
          selectAllLabel: t('tasks.currentBatch.selection.selectCurrentPage'),
          selectedRowsLabel: (count) => t('tasks.currentBatch.selection.selectedCount', { count }),
          clearSelectionLabel: t('tasks.currentBatch.selection.clear'),
        }}
        batchActions={batchActions}
        pagination={
          <InteractiveTablePagination
            page={query.page}
            pageSize={query.page_size}
            total={total}
            labels={{
              summary: (model) =>
                t('tasks.pagination.summary', {
                  start: model.start,
                  end: model.end,
                  total: model.total,
                }),
              previous: t('tasks.pagination.previous'),
              next: t('tasks.pagination.next'),
              page: (page) => t('tasks.pagination.page', { current: page, total: totalPages }),
            }}
            onPageChange={setPage}
          />
        }
        onRowClick={onOpenTaskDetail}
        scrollAreaClassName="max-h-[30rem] overflow-auto"
        stickyHeader
        emptyState={
          <EmptyState
            icon={<ListTodo className="size-7" />}
            title={emptyText ?? t('tasks.currentBatch.empty')}
            description={t('tasks.workbench.sections.activity.waiting')}
            className="min-h-48 border-0 bg-transparent px-0 py-10"
          />
        }
      />
    </section>
  )
}
