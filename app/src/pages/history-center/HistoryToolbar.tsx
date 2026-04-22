import { ArrowUpDown, Download, FileText, Filter, Hash, Search } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { HistoryRecordsMode } from '@/routes/history-search'
import type { SortOrder, TaskFilterStatus, TaskSortBy } from '@/shared/types'

export interface HistoryToolbarProps {
  mode: HistoryRecordsMode
  searchValue: string
  statusValue: TaskFilterStatus
  sortByValue: TaskSortBy
  orderValue: SortOrder
  isLoading?: boolean
  canExportSelection?: boolean
  showExportSelection?: boolean
  onSearchChange: (value: string) => void
  onSearchSubmit: (value: string) => void
  onStatusChange: (value: TaskFilterStatus) => void
  onSortByChange: (value: TaskSortBy) => void
  onOrderChange: (value: SortOrder) => void
  onExportSelection?: () => void
  onModeChange?: (mode: HistoryRecordsMode) => void
}

const STATUS_OPTIONS: readonly TaskFilterStatus[] = [
  'all',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]

const SORT_OPTIONS: readonly TaskSortBy[] = [
  'created_at',
  'completed_at',
  'status',
  'progress',
  'filename',
]

const ORDER_OPTIONS: readonly SortOrder[] = ['desc', 'asc']

export function HistoryToolbar({
  mode,
  searchValue,
  statusValue,
  sortByValue,
  orderValue,
  isLoading = false,
  canExportSelection = false,
  showExportSelection = true,
  onSearchChange,
  onSearchSubmit,
  onStatusChange,
  onSortByChange,
  onOrderChange,
  onExportSelection,
  onModeChange,
}: HistoryToolbarProps) {
  const { t } = useTranslation()

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter') return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    onSearchSubmit(searchValue)
  }

  return (
    <div
      data-slot="history-toolbar"
      className="bg-surface-container-low/30 flex flex-col gap-4 border-b px-5 py-4"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          {mode === 'tasks' ? (
            <label className="relative w-full max-w-md">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={searchValue}
                disabled={isLoading}
                aria-label={t('history.toolbar.searchLabel')}
                placeholder={t('history.toolbar.searchPlaceholder')}
                className="bg-background pl-9"
                onChange={(event) => {
                  onSearchChange(event.target.value)
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </label>
          ) : null}

          <div
            data-slot="history-mode-toggle"
            className="bg-surface-container inline-flex w-fit items-center gap-1 rounded-lg p-1"
          >
            <Button
              type="button"
              size="xs"
              variant={mode === 'files' ? 'secondary' : 'ghost'}
              className="text-[10px] font-semibold tracking-[0.18em] uppercase"
              disabled={isLoading || !onModeChange}
              onClick={() => {
                onModeChange?.('files')
              }}
            >
              <FileText />
              {t('history.modes.files')}
            </Button>
            <Button
              type="button"
              size="xs"
              variant={mode === 'tasks' ? 'secondary' : 'ghost'}
              className="text-[10px] font-semibold tracking-[0.18em] uppercase"
              disabled={isLoading || !onModeChange}
              onClick={() => {
                onModeChange?.('tasks')
              }}
            >
              <Hash />
              {t('history.modes.tasks')}
            </Button>
          </div>

          {mode === 'tasks' ? (
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
              <Select
                value={statusValue}
                disabled={isLoading}
                onValueChange={(value) => {
                  onStatusChange(value as TaskFilterStatus)
                }}
              >
                <SelectTrigger
                  className="w-full min-w-[152px] lg:w-[168px]"
                  aria-label={t('history.toolbar.status')}
                >
                  <div className="flex items-center gap-2">
                    <Filter className="size-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === 'all'
                        ? t('tasks.filters.statusAll')
                        : t(`tasks.status.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sortByValue}
                disabled={isLoading}
                onValueChange={(value) => {
                  onSortByChange(value as TaskSortBy)
                }}
              >
                <SelectTrigger
                  className="w-full min-w-[176px] lg:w-[188px]"
                  aria-label={t('history.toolbar.sortBy')}
                >
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="size-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`tasks.filters.sortBy.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={orderValue}
                disabled={isLoading}
                onValueChange={(value) => {
                  onOrderChange(value as SortOrder)
                }}
              >
                <SelectTrigger
                  className="w-full min-w-[132px] lg:w-[140px]"
                  aria-label={t('history.toolbar.order')}
                >
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="size-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {ORDER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`tasks.filters.order.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {showExportSelection ? (
          <Button
            type="button"
            size="sm"
            className="text-[11px] font-semibold tracking-[0.18em] uppercase"
            disabled={isLoading || !canExportSelection || !onExportSelection}
            onClick={onExportSelection}
          >
            <Download />
            {t('history.toolbar.exportSelected')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
