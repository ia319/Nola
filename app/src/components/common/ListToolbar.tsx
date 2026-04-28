import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  DEFAULT_TASK_FILTER_STATUS,
  TASK_FILTER_STATUS_OPTIONS,
  TASK_ORDER_OPTIONS,
  TASK_SORT_OPTIONS,
} from '@/shared/lib/task-query-options'
import type { SortOrder, TaskFilterStatus, TaskSortBy } from '@/shared/types'

export interface ListToolbarProps {
  searchValue: string
  statusValue: TaskFilterStatus
  sortByValue: TaskSortBy
  orderValue: SortOrder
  onSearchChange: (value: string) => void
  onSearchSubmit?: (value: string) => void
  onStatusChange: (value: TaskFilterStatus) => void
  onSortByChange: (value: TaskSortBy) => void
  onOrderChange: (value: SortOrder) => void
  disabled?: boolean
  className?: string
}

/**
 * Keep list query controls consistent between recent and history panels.
 */
export function ListToolbar({
  searchValue,
  statusValue,
  sortByValue,
  orderValue,
  onSearchChange,
  onSearchSubmit,
  onStatusChange,
  onSortByChange,
  onOrderChange,
  disabled = false,
  className,
}: ListToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Input
        value={searchValue}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value)
        }}
        onKeyDown={(event) => {
          if (!onSearchSubmit) return
          if (event.key !== 'Enter') return
          if (event.nativeEvent.isComposing) return
          // TODO: Add an explicit search trigger control when product requires click-based submit.
          event.preventDefault()
          onSearchSubmit(searchValue)
        }}
        className="min-w-[220px] flex-1"
        placeholder={t('tasks.filters.searchPlaceholder')}
      />

      <Select
        value={statusValue}
        disabled={disabled}
        onValueChange={(value) => {
          onStatusChange(value as TaskFilterStatus)
        }}
      >
        <SelectTrigger className="w-[160px]">
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

      <Select
        value={sortByValue}
        disabled={disabled}
        onValueChange={(value) => {
          onSortByChange(value as TaskSortBy)
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_SORT_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`tasks.filters.sortBy.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={orderValue}
        disabled={disabled}
        onValueChange={(value) => {
          onOrderChange(value as SortOrder)
        }}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_ORDER_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`tasks.filters.order.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
