import type {
  ModelListApiQuery,
  ModelListFilterStatus,
  ModelListSortBy,
  ModelListSortOrder,
} from '../types'

export type { ModelListApiQuery, ModelListSortBy, ModelListSortOrder } from '../types'

export type ModelListStatusFilter = 'all' | ModelListFilterStatus

export interface ModelListQuery {
  q: string
  status: ModelListStatusFilter
  sort_by: ModelListSortBy | null
  order: ModelListSortOrder
}

export const DEFAULT_MODEL_LIST_STATUS: ModelListStatusFilter = 'all'

export const DEFAULT_MODEL_LIST_QUERY: ModelListQuery = {
  q: '',
  status: DEFAULT_MODEL_LIST_STATUS,
  sort_by: null,
  order: 'asc',
}

const MODEL_LIST_STATUS_OPTION_FLAGS: Record<ModelListFilterStatus, true> = {
  downloaded: true,
  downloading: true,
  partial_download: true,
  not_downloaded: true,
}

const MODEL_LIST_API_STATUS_OPTIONS = Object.keys(
  MODEL_LIST_STATUS_OPTION_FLAGS,
) as readonly ModelListFilterStatus[]

export const MODEL_LIST_STATUS_OPTIONS = [
  DEFAULT_MODEL_LIST_STATUS,
  ...MODEL_LIST_API_STATUS_OPTIONS,
] satisfies readonly ModelListStatusFilter[]

function isApiModelStatus(status: ModelListStatusFilter): status is ModelListFilterStatus {
  return status !== DEFAULT_MODEL_LIST_STATUS
}

export function toModelListApiQuery(query: ModelListQuery): ModelListApiQuery {
  const apiQuery: ModelListApiQuery = {}
  const search = query.q.trim()

  if (search) {
    apiQuery.q = search
  }

  if (isApiModelStatus(query.status)) {
    apiQuery.status = query.status
  }

  if (query.sort_by) {
    apiQuery.sort_by = query.sort_by
    apiQuery.order = query.order
  }

  return apiQuery
}
