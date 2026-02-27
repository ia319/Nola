import apiClient from '@/shared/lib/api-client'
import type { BatchExportRequest, ExportFormat, SavedExportResponse } from '@/shared/types'

const BASE = '/api/transcriptions'

/** Download export as Blob for browser file download. */
export async function downloadExport(
  taskId: string,
  params: {
    format?: ExportFormat
    include_timestamps?: boolean
  } = {},
  signal?: AbortSignal,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${BASE}/${taskId}/export`, {
    params: { ...params, save: false },
    responseType: 'blob',
    signal,
  })
  return data
}

/** Save export to server-side path. */
export async function saveExport(
  taskId: string,
  params: {
    format?: ExportFormat
    include_timestamps?: boolean
  } = {},
  signal?: AbortSignal,
): Promise<SavedExportResponse> {
  const { data } = await apiClient.get<SavedExportResponse>(`${BASE}/${taskId}/export`, {
    params: { ...params, save: true },
    signal,
  })
  return data
}

/** Batch export multiple tasks as ZIP. */
export async function batchExport(
  request: BatchExportRequest,
  signal?: AbortSignal,
): Promise<Blob> {
  const { data } = await apiClient.post<Blob>(BASE + '/export/batch', request, {
    responseType: 'blob',
    signal,
  })
  return data
}
