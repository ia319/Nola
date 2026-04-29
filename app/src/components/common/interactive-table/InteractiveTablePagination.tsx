import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type PaginationItem = number | 'ellipsis'

export interface InteractiveTablePaginationModel {
  page: number
  pageSize: number
  total: number
  totalPages: number
  start: number
  end: number
}

export interface InteractiveTablePaginationLabels {
  summary?: (model: InteractiveTablePaginationModel) => ReactNode
  pageSize?: string
  previous?: string
  next?: string
  page?: (page: number) => string
}

export type InteractiveTablePaginationProps = Omit<
  ComponentPropsWithoutRef<'footer'>,
  'children'
> & {
  page: number
  pageSize: number
  total: number
  pageSizeOptions?: readonly number[]
  isLoading?: boolean
  labels?: InteractiveTablePaginationLabels
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.floor(value))
}

function normalizeTotal(total: number): number {
  if (!Number.isFinite(total)) {
    return 0
  }

  return Math.max(0, Math.floor(total))
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

function buildPaginationModel(
  page: number,
  pageSize: number,
  total: number,
): InteractiveTablePaginationModel {
  const normalizedTotal = normalizeTotal(total)
  const normalizedPageSize = normalizePositiveInteger(pageSize, 1)
  const totalPages = Math.max(1, Math.ceil(normalizedTotal / normalizedPageSize))
  const normalizedPage = normalizePositiveInteger(page, 1)
  const currentPage = Math.min(normalizedPage, totalPages)
  const start = normalizedTotal === 0 ? 0 : (currentPage - 1) * normalizedPageSize + 1
  const end =
    normalizedTotal === 0 ? 0 : Math.min(normalizedTotal, currentPage * normalizedPageSize)

  return {
    page: currentPage,
    pageSize: normalizedPageSize,
    total: normalizedTotal,
    totalPages,
    start,
    end,
  }
}

function buildPageSizeOptions(options: readonly number[], currentPageSize: number): number[] {
  const seen = new Set<number>()
  const normalizedOptions: number[] = []

  for (const option of options) {
    const normalizedOption = normalizePositiveInteger(option, currentPageSize)
    if (seen.has(normalizedOption)) {
      continue
    }

    seen.add(normalizedOption)
    normalizedOptions.push(normalizedOption)
  }

  if (!seen.has(currentPageSize)) {
    normalizedOptions.push(currentPageSize)
  }

  return normalizedOptions
}

function defaultSummaryLabel(model: InteractiveTablePaginationModel): string {
  return `Showing ${model.start}-${model.end} of ${model.total}`
}

function defaultPageLabel(page: number): string {
  return `Page ${page}`
}

/**
 * Render table pagination controls with the same surface and spacing as History tables.
 */
export function InteractiveTablePagination({
  page,
  pageSize,
  total,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  isLoading = false,
  labels,
  onPageChange,
  onPageSizeChange,
  className,
  ...props
}: InteractiveTablePaginationProps) {
  const model = useMemo(() => buildPaginationModel(page, pageSize, total), [page, pageSize, total])
  const items = useMemo(
    () => buildPaginationItems(model.page, model.totalPages),
    [model.page, model.totalPages],
  )
  const resolvedPageSizeOptions = useMemo(
    () => buildPageSizeOptions(pageSizeOptions, model.pageSize),
    [model.pageSize, pageSizeOptions],
  )
  const summaryLabel = labels?.summary ?? defaultSummaryLabel
  const pageLabel = labels?.page ?? defaultPageLabel
  const pageSizeLabel = labels?.pageSize ?? 'Page size'
  const previousLabel = labels?.previous ?? 'Previous page'
  const nextLabel = labels?.next ?? 'Next page'

  return (
    <footer
      data-slot="interactive-table-pagination"
      className={cn(
        'flex flex-col gap-4 border-t px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-muted-foreground">{summaryLabel(model)}</p>

        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              {pageSizeLabel}
            </span>
            <Select
              value={String(model.pageSize)}
              onValueChange={(value) => {
                const nextPageSize = resolvedPageSizeOptions.find(
                  (option) => String(option) === value,
                )
                if (typeof nextPageSize !== 'undefined') {
                  onPageSizeChange(nextPageSize)
                }
              }}
            >
              <SelectTrigger size="sm" className="w-[88px]" aria-label={pageSizeLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolvedPageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={previousLabel}
          disabled={isLoading || model.page <= 1}
          onClick={() => {
            onPageChange(model.page - 1)
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
              variant={item === model.page ? 'default' : 'ghost'}
              aria-label={pageLabel(item)}
              aria-current={item === model.page ? 'page' : undefined}
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
          aria-label={nextLabel}
          disabled={isLoading || model.page >= model.totalPages}
          onClick={() => {
            onPageChange(model.page + 1)
          }}
        >
          <ChevronRight />
        </Button>
      </div>
    </footer>
  )
}
