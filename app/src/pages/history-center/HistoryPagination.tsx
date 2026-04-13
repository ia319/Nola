import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HISTORY_PAGE_SIZE_OPTIONS, type HistoryPageSize } from '@/routes/history-search'

type PaginationItem = number | 'ellipsis'

export interface HistoryPaginationProps {
  page: number
  pageSize: HistoryPageSize
  total: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: HistoryPageSize) => void
}

function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 2) {
    return [1, 2, 3, 4, 'ellipsis', totalPages]
  }

  if (currentPage >= totalPages - 1) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages]
}

export function HistoryPagination({
  page,
  pageSize,
  total,
  isLoading = false,
  onPageChange,
  onPageSizeChange,
}: HistoryPaginationProps) {
  const { t } = useTranslation()

  const model = useMemo(() => {
    const normalizedTotal = Math.max(total, 0)
    const normalizedPageSize = Math.max(pageSize, 1)
    const totalPages = Math.max(1, Math.ceil(normalizedTotal / normalizedPageSize))
    const currentPage = Math.min(Math.max(page, 1), totalPages)
    const start = normalizedTotal === 0 ? 0 : (currentPage - 1) * normalizedPageSize + 1
    const end =
      normalizedTotal === 0 ? 0 : Math.min(normalizedTotal, currentPage * normalizedPageSize)

    return {
      currentPage,
      end,
      start,
      total: normalizedTotal,
      totalPages,
    }
  }, [page, pageSize, total])

  const items = useMemo(
    () => buildPaginationItems(model.currentPage, model.totalPages),
    [model.currentPage, model.totalPages],
  )

  return (
    <footer
      data-slot="history-pagination"
      className="flex flex-col gap-4 border-t px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-muted-foreground">
          {t('history.pagination.summary', {
            end: model.end,
            start: model.start,
            total: model.total,
          })}
        </p>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            {t('history.pagination.pageSize')}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              const nextPageSize = HISTORY_PAGE_SIZE_OPTIONS.find(
                (option) => String(option) === value,
              )
              if (typeof nextPageSize !== 'undefined') {
                onPageSizeChange(nextPageSize)
              }
            }}
          >
            <SelectTrigger size="sm" className="w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HISTORY_PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t('history.pagination.previous')}
          disabled={isLoading || model.currentPage <= 1}
          onClick={() => {
            onPageChange(model.currentPage - 1)
          }}
        >
          <ChevronLeft />
        </Button>

        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="text-muted-foreground px-1">
              <MoreHorizontal className="size-4" />
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              size="icon-sm"
              variant={item === model.currentPage ? 'default' : 'ghost'}
              aria-label={t('history.pagination.page', { page: item })}
              disabled={isLoading}
              onClick={() => {
                onPageChange(item)
              }}
            >
              {item}
            </Button>
          ),
        )}

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t('history.pagination.next')}
          disabled={isLoading || model.currentPage >= model.totalPages}
          onClick={() => {
            onPageChange(model.currentPage + 1)
          }}
        >
          <ChevronRight />
        </Button>
      </div>
    </footer>
  )
}
