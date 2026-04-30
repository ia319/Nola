import { useTranslation } from 'react-i18next'

import { InteractiveTablePagination } from '@/components/common'
import { HISTORY_PAGE_SIZE_OPTIONS, type HistoryPageSize } from '@/routes/history-search'

export interface HistoryPaginationProps {
  page: number
  pageSize: HistoryPageSize
  total: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: HistoryPageSize) => void
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

  return (
    <InteractiveTablePagination
      page={page}
      pageSize={pageSize}
      total={total}
      pageSizeOptions={HISTORY_PAGE_SIZE_OPTIONS}
      isLoading={isLoading}
      labels={{
        summary: (model) =>
          t('history.pagination.summary', {
            end: model.end,
            start: model.start,
            total: model.total,
          }),
        pageSize: t('history.pagination.pageSize'),
        previous: t('history.pagination.previous'),
        next: t('history.pagination.next'),
        page: (pageNumber) => t('history.pagination.page', { page: pageNumber }),
      }}
      onPageChange={onPageChange}
      onPageSizeChange={(nextPageSize) => {
        const resolvedPageSize = HISTORY_PAGE_SIZE_OPTIONS.find((option) => option === nextPageSize)
        if (typeof resolvedPageSize !== 'undefined') {
          onPageSizeChange(resolvedPageSize)
        }
      }}
    />
  )
}
