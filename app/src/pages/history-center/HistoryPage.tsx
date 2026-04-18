import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { localizePath } from '@/app/locale/locale-routing'
import { useActiveLocale } from '@/app/locale/use-active-locale'
import { ErrorBoundary } from '@/components/common'
import { HISTORY_PAGE_SIZE } from '@/config/constants'
import { ContentCanvas } from '@/layouts'
import {
  buildHistoryFileQuery,
  buildHistoryTaskQuery,
  type HistoryRecordsMode,
  type HistoryPageSize,
  type HistoryRouteSearch,
} from '@/routes/history-search'
import type { SortOrder, TaskFilterStatus, TaskSortBy } from '@/shared/types'
import { HistoryFileModeView } from './HistoryFileModeView'
import { HistoryTaskModeView } from './HistoryTaskModeView'

interface HistoryPageProps {
  search: HistoryRouteSearch
  updateSearch: (patch: Partial<HistoryRouteSearch>, replace: boolean) => void
}

export function HistoryPage({ search, updateSearch }: HistoryPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const activeLocale = useActiveLocale()
  const mode = search.mode ?? 'tasks'
  const taskQuery = useMemo(() => buildHistoryTaskQuery(search), [search])
  const fileQuery = useMemo(() => buildHistoryFileQuery(search), [search])

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

  const handleSortByChange = useCallback(
    (value: TaskSortBy) => {
      updateSearch(
        {
          sort_by: value === 'created_at' ? undefined : value,
          page: undefined,
        },
        false,
      )
    },
    [updateSearch],
  )

  const handleOrderChange = useCallback(
    (value: SortOrder) => {
      updateSearch(
        {
          order: value === 'desc' ? undefined : value,
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
  const handleModeChange = useCallback(
    (nextMode: HistoryRecordsMode) => {
      updateSearch(
        {
          mode: nextMode === 'tasks' ? undefined : nextMode,
          q: undefined,
          status: undefined,
          sort_by: undefined,
          order: undefined,
          page: undefined,
        },
        false,
      )
    },
    [updateSearch],
  )

  return (
    <ErrorBoundary>
      <ContentCanvas
        as="main"
        width="full"
        height="fill"
        className="gap-0 px-0 py-0"
        data-slot="history-page"
      >
        <h1 className="sr-only">{t('history.title')}</h1>
        <p className="sr-only">{t('history.description')}</p>
        {mode === 'tasks' ? (
          <HistoryTaskModeView
            query={taskQuery}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onSortByChange={handleSortByChange}
            onOrderChange={handleOrderChange}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onPageClamp={handlePageClamp}
            onModeChange={handleModeChange}
            onCreateTask={() => {
              void navigate({ to: localizePath('/', activeLocale) })
            }}
          />
        ) : (
          <HistoryFileModeView
            query={fileQuery}
            onPageClamp={handlePageClamp}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onModeChange={handleModeChange}
            onCreateTask={() => {
              void navigate({ to: localizePath('/', activeLocale) })
            }}
          />
        )}
      </ContentCanvas>
    </ErrorBoundary>
  )
}
