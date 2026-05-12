import { FileText, Filter, Hash, Search, X } from 'lucide-react'
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
import {
  DEFAULT_FILE_CONTENT_TYPE_FILTER,
  FILE_CONTENT_TYPE_FILTER_OPTIONS,
  type FileContentTypeFilterValue,
} from '@/shared/lib/file-query-options'
import {
  DEFAULT_LIVE_FILTER_STATUS,
  LIVE_FILTER_STATUS_OPTIONS,
  type LiveSessionFilterStatus,
} from '@/shared/lib/live-query-options'
import {
  DEFAULT_TASK_FILTER_STATUS,
  TASK_FILTER_STATUS_OPTIONS,
} from '@/shared/lib/task-query-options'
import type { TaskFilterStatus } from '@/shared/types'

type HistoryToolbarMode = HistoryRecordsMode | 'live'

export interface HistoryToolbarProps {
  mode: HistoryToolbarMode
  searchValue: string
  isLoading?: boolean
  statusValue?: TaskFilterStatus
  liveStatusValue?: LiveSessionFilterStatus
  contentTypeValue?: FileContentTypeFilterValue
  showRecordsModeToggle?: boolean
  onSearchChange: (value: string) => void
  onSearchSubmit: (value: string) => void
  onStatusChange?: (value: TaskFilterStatus) => void
  onLiveStatusChange?: (value: LiveSessionFilterStatus) => void
  onContentTypeChange?: (value: FileContentTypeFilterValue) => void
  onModeChange?: (mode: HistoryRecordsMode) => void
}

export function HistoryToolbar({
  mode,
  searchValue,
  isLoading = false,
  statusValue = DEFAULT_TASK_FILTER_STATUS,
  liveStatusValue = DEFAULT_LIVE_FILTER_STATUS,
  contentTypeValue = DEFAULT_FILE_CONTENT_TYPE_FILTER,
  showRecordsModeToggle = true,
  onSearchChange,
  onSearchSubmit,
  onStatusChange,
  onLiveStatusChange,
  onContentTypeChange,
  onModeChange,
}: HistoryToolbarProps) {
  const { t } = useTranslation()
  const searchPlaceholder = (() => {
    if (mode === 'files') {
      return t('history.files.filters.searchPlaceholder')
    }
    if (mode === 'live') {
      return t('history.live.filters.searchPlaceholder')
    }
    return t('history.toolbar.searchPlaceholder')
  })()

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter') return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    onSearchSubmit(searchValue)
  }

  function handleClearSearch(): void {
    onSearchChange('')
    onSearchSubmit('')
  }

  return (
    <div data-slot="history-toolbar" className="flex flex-col gap-4 xl:flex-row xl:items-center">
      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block w-full max-w-md min-w-[220px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={searchValue}
            disabled={isLoading}
            aria-label={t('history.toolbar.searchLabel')}
            placeholder={searchPlaceholder}
            className="bg-background pr-9 pl-9"
            onChange={(event) => {
              onSearchChange(event.target.value)
            }}
            onKeyDown={handleSearchKeyDown}
          />
          {searchValue ? (
            <button
              type="button"
              aria-label={t('history.toolbar.clearSearch')}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              disabled={isLoading}
              onClick={handleClearSearch}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </label>

        {showRecordsModeToggle && mode !== 'live' ? (
          <div
            data-slot="history-mode-toggle"
            className="bg-surface-container inline-flex w-fit items-center gap-1 rounded-lg p-1"
          >
            <Button
              type="button"
              size="xs"
              variant={mode === 'files' ? 'secondary' : 'ghost'}
              className="aria-pressed:bg-background aria-pressed:text-foreground text-[10px] font-semibold tracking-[0.18em] uppercase aria-pressed:shadow-xs"
              aria-pressed={mode === 'files'}
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
              className="aria-pressed:bg-background aria-pressed:text-foreground text-[10px] font-semibold tracking-[0.18em] uppercase aria-pressed:shadow-xs"
              aria-pressed={mode === 'tasks'}
              disabled={isLoading || !onModeChange}
              onClick={() => {
                onModeChange?.('tasks')
              }}
            >
              <Hash />
              {t('history.modes.tasks')}
            </Button>
          </div>
        ) : null}

        {mode === 'tasks' ? (
          <Select
            value={statusValue}
            disabled={isLoading || !onStatusChange}
            onValueChange={(value) => {
              onStatusChange?.(value as TaskFilterStatus)
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
              {TASK_FILTER_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === DEFAULT_TASK_FILTER_STATUS
                    ? t('tasks.filters.statusAll')
                    : t(`tasks.status.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : mode === 'live' ? (
          <Select
            value={liveStatusValue}
            disabled={isLoading || !onLiveStatusChange}
            onValueChange={(value) => {
              onLiveStatusChange?.(value as LiveSessionFilterStatus)
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
              {LIVE_FILTER_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === DEFAULT_LIVE_FILTER_STATUS
                    ? t('history.live.filters.statusAll')
                    : t(`history.live.status.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={contentTypeValue}
            disabled={isLoading || !onContentTypeChange}
            onValueChange={(value) => {
              onContentTypeChange?.(value as FileContentTypeFilterValue)
            }}
          >
            <SelectTrigger
              className="w-full min-w-[188px] lg:w-[220px]"
              aria-label={t('history.files.filters.contentType')}
            >
              <div className="flex items-center gap-2">
                <Filter className="size-4" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {FILE_CONTENT_TYPE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === DEFAULT_FILE_CONTENT_TYPE_FILTER
                    ? t('history.files.filters.contentTypeAll')
                    : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
