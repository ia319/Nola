import { ALLOWED_MIME_TYPES } from '@/config/constants'
import type { FileContentTypeFilter, FileSortBy, FileSortOrder } from '@/shared/types'

export type FileContentTypeFilterValue = 'all' | FileContentTypeFilter

export const DEFAULT_FILE_CONTENT_TYPE_FILTER = 'all' satisfies FileContentTypeFilterValue
export const DEFAULT_FILE_SORT_BY = 'created_at' satisfies FileSortBy
export const DEFAULT_FILE_SORT_ORDER = 'desc' satisfies FileSortOrder

const FILE_SORT_OPTION_FLAGS: Record<FileSortBy, true> = {
  filename: true,
  size: true,
  content_type: true,
  created_at: true,
}

const FILE_ORDER_OPTION_FLAGS: Record<FileSortOrder, true> = {
  desc: true,
  asc: true,
}

export const FILE_SORT_OPTIONS = Object.keys(FILE_SORT_OPTION_FLAGS) as readonly FileSortBy[]

export const FILE_ORDER_OPTIONS = Object.keys(FILE_ORDER_OPTION_FLAGS) as readonly FileSortOrder[]

export const FILE_CONTENT_TYPE_FILTER_OPTIONS = [
  DEFAULT_FILE_CONTENT_TYPE_FILTER,
  ...ALLOWED_MIME_TYPES,
] as const satisfies readonly FileContentTypeFilterValue[]
