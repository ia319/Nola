import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { localizePath } from '@/app/locale/locale-routing'
import { useActiveLocale } from '@/app/locale/use-active-locale'
import { ErrorBoundary, type InteractiveSortState } from '@/components/common'
import { HISTORY_PAGE_SIZE } from '@/config/constants'
import { ContentCanvas } from '@/layouts'
import { cn } from '@/lib/utils'
import {
  buildHistoryFileQuery,
  buildHistoryLiveQuery,
  buildHistoryTaskQuery,
  type HistoryRecordsMode,
  type HistoryPageSize,
  type HistoryRouteSearch,
} from '@/routes/history-search'
import { DEFAULT_FILE_CONTENT_TYPE_FILTER } from '@/shared/lib/file-query-options'
import {
  DEFAULT_LIVE_FILTER_STATUS,
  DEFAULT_LIVE_SORT_BY,
  DEFAULT_LIVE_SORT_ORDER,
  type LiveHistorySortBy,
  type LiveSessionFilterStatus,
} from '@/shared/lib/live-query-options'
import type { FileSortBy, FileSortOrder, TaskFilterStatus, TaskSortBy } from '@/shared/types'
import { HistoryFileModeView } from './HistoryFileModeView'
import { HistoryLiveModeView } from './HistoryLiveModeView'
import { HistoryTaskModeView } from './HistoryTaskModeView'

type HistoryViewMode = 'live' | 'task'

const HISTORY_VIEW_TABS: readonly {
  key: HistoryViewMode
  labelKey: 'history.views.live' | 'history.views.task'
}[] = [
  {
    key: 'task',
    labelKey: 'history.views.task',
  },
  {
    key: 'live',
    labelKey: 'history.views.live',
  },
]

interface HistoryPageProps {
  search: HistoryRouteSearch
  updateSearch: (patch: Partial<HistoryRouteSearch>, replace: boolean) => void
}

export function HistoryPage({ search, updateSearch }: HistoryPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const activeLocale = useActiveLocale()
  const viewMode: HistoryViewMode = search.mode === 'live' ? 'live' : 'task'
  const recordsMode: HistoryRecordsMode = search.mode === 'files' ? 'files' : 'tasks'
  const taskQuery = useMemo(() => buildHistoryTaskQuery(search), [search])
  const fileQuery = useMemo(() => buildHistoryFileQuery(search), [search])
  const liveQuery = useMemo(() => buildHistoryLiveQuery(search), [search])

  const handleSearchChange = useCallback(
    (value: string) => {
      updateSearch({ q: value, page: undefined }, false)
    },
    [updateSearch],
  )

  const handleStatusChange = useCallback(
    (value: TaskFilterStatus) => {
      updateSearch(
        {
          status: value === 'all' ? undefined : value,
          page: undefined,
        },
        true,
      )
    },
    [updateSearch],
  )

  const handleTaskSortChange = useCallback(
    (sort: InteractiveSortState<TaskSortBy>) => {
      updateSearch(
        {
          sort_by: sort.key === 'created_at' ? undefined : sort.key,
          order: sort.direction === 'desc' ? undefined : sort.direction,
          page: undefined,
        },
        false,
      )
    },
    [updateSearch],
  )

  const handleLiveStatusChange = useCallback(
    (value: LiveSessionFilterStatus) => {
      updateSearch(
        {
          status: value === DEFAULT_LIVE_FILTER_STATUS ? undefined : value,
          page: undefined,
        },
        true,
      )
    },
    [updateSearch],
  )

  const handleLiveSortChange = useCallback(
    (sort: InteractiveSortState<LiveHistorySortBy>) => {
      updateSearch(
        {
          sort_by: sort.key === DEFAULT_LIVE_SORT_BY ? undefined : sort.key,
          order: sort.direction === DEFAULT_LIVE_SORT_ORDER ? undefined : sort.direction,
          page: undefined,
        },
        false,
      )
    },
    [updateSearch],
  )

  const handleFileContentTypeChange = useCallback(
    (value: string) => {
      updateSearch(
        {
          content_type: value === DEFAULT_FILE_CONTENT_TYPE_FILTER ? undefined : value,
          page: undefined,
        },
        true,
      )
    },
    [updateSearch],
  )

  const handleFileSortChange = useCallback(
    (sort: InteractiveSortState<FileSortBy>) => {
      updateSearch(
        {
          sort_by: sort.key === 'created_at' ? undefined : sort.key,
          order: sort.direction === 'desc' ? undefined : (sort.direction as FileSortOrder),
          page: undefined,
        },
        false,
      )
    },
    [updateSearch],
  )

  const handlePageChange = useCallback(
    (value: number) => {
      const nextPage = Math.max(1, Math.floor(value))
      updateSearch({ page: nextPage <= 1 ? undefined : nextPage }, false)
    },
    [updateSearch],
  )

  const handlePageSizeChange = useCallback(
    (value: HistoryPageSize) => {
      updateSearch(
        {
          page: undefined,
          page_size: value === HISTORY_PAGE_SIZE ? undefined : value,
        },
        false,
      )
    },
    [updateSearch],
  )

  const handlePageClamp = useCallback(
    (page: number) => {
      updateSearch({ page: page <= 1 ? undefined : page }, true)
    },
    [updateSearch],
  )
  const handleViewChange = useCallback(
    (nextMode: HistoryViewMode) => {
      if (nextMode === viewMode) {
        return
      }

      updateSearch(
        {
          mode: nextMode === 'task' ? undefined : 'live',
          q: undefined,
          status: undefined,
          content_type: undefined,
          sort_by: undefined,
          order: undefined,
          page: undefined,
        },
        false,
      )
    },
    [updateSearch, viewMode],
  )
  const handleModeChange = useCallback(
    (nextMode: HistoryRecordsMode) => {
      updateSearch(
        {
          mode: nextMode === 'tasks' ? undefined : nextMode,
          status: undefined,
          content_type: undefined,
          sort_by: undefined,
          order: undefined,
          page: undefined,
        },
        false,
      )
    },
    [updateSearch],
  )
  const handleCreateTask = useCallback(() => {
    void navigate({ to: localizePath('/', activeLocale) })
  }, [activeLocale, navigate])

  return (
    <ErrorBoundary>
      <main data-slot="history-page" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-outline-variant/70 bg-background/95 border-b">
          <ContentCanvas width="full" className="gap-4 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <h1 className="text-foreground text-xl font-semibold tracking-tight">
                  {t('history.title')}
                </h1>
                <p className="text-muted-foreground text-sm">{t('history.description')}</p>
              </div>

              <nav
                aria-label={t('history.navigationLabel')}
                className="-mx-1 flex items-center gap-1 overflow-x-auto px-1"
              >
                {HISTORY_VIEW_TABS.map((tab) => {
                  const active = viewMode === tab.key

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                        active
                          ? 'border-foreground text-foreground'
                          : 'text-muted-foreground hover:text-foreground border-transparent',
                      )}
                      onClick={() => {
                        handleViewChange(tab.key)
                      }}
                    >
                      {t(tab.labelKey)}
                    </button>
                  )
                })}
              </nav>
            </div>
          </ContentCanvas>
        </div>

        <ContentCanvas width="full" height="fill" className="min-w-0 gap-0 px-0 py-0">
          <div className="flex min-h-0 flex-1 flex-col">
            {viewMode === 'live' ? (
              <HistoryLiveModeView
                query={liveQuery}
                onSearchChange={handleSearchChange}
                onStatusChange={handleLiveStatusChange}
                onSortChange={handleLiveSortChange}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onPageClamp={handlePageClamp}
              />
            ) : recordsMode === 'tasks' ? (
              <HistoryTaskModeView
                query={taskQuery}
                onSearchChange={handleSearchChange}
                onStatusChange={handleStatusChange}
                onSortChange={handleTaskSortChange}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onPageClamp={handlePageClamp}
                onModeChange={handleModeChange}
                onCreateTask={handleCreateTask}
              />
            ) : (
              <HistoryFileModeView
                query={fileQuery}
                onSearchChange={handleSearchChange}
                onContentTypeChange={handleFileContentTypeChange}
                onSortChange={handleFileSortChange}
                onPageClamp={handlePageClamp}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onModeChange={handleModeChange}
                onCreateTask={handleCreateTask}
              />
            )}
          </div>
        </ContentCanvas>
      </main>
    </ErrorBoundary>
  )
}
