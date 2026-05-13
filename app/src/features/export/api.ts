import apiClient from '@/shared/lib/api-client'
import { parseFilenameFromContentDisposition } from '@/shared/lib/content-disposition'
import type {
  BatchExportRequest,
  ExportConfig,
  ExportDefaultsPatchResponse,
  ExportDefaultsUpdateRequest,
  ExportFormat,
  SavedExportResponse,
} from '@/shared/types'

const BASE = '/api/transcription-tasks'
const CONFIG_BASE = '/api/config/export'

export interface ExportRequestOptions {
  format: ExportFormat
  include_timestamps: boolean
}

export type SingleExportTarget = 'download' | 'save'

export interface SingleExportApiOptions {
  format?: ExportFormat
  include_timestamps?: boolean
  filename?: string
}

export interface SingleExportRequestOptions extends ExportRequestOptions {
  target?: SingleExportTarget
  filename?: string
}

export interface BatchExportDownloadResult {
  blob: Blob
  filename: string | null
}

export interface SingleExportDownloadResult {
  blob: Blob
  filename: string | null
}

/** Download export as Blob for browser file download. */
export async function downloadExport(
  taskId: string,
  params: SingleExportApiOptions = {},
  signal?: AbortSignal,
): Promise<SingleExportDownloadResult> {
  const response = await apiClient.get<Blob>(`${BASE}/${taskId}/export`, {
    params: { ...params, save: false },
    responseType: 'blob',
    signal,
  })
  const filename = parseFilenameFromContentDisposition(response.headers['content-disposition'])
  return {
    blob: response.data,
    filename,
  }
}

/** Save export to server-side path. */
export async function saveExport(
  taskId: string,
  params: SingleExportApiOptions = {},
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
): Promise<BatchExportDownloadResult> {
  const response = await apiClient.post<Blob>(BASE + '/export/batch', request, {
    responseType: 'blob',
    signal,
  })
  const filename = parseFilenameFromContentDisposition(response.headers['content-disposition'])
  return {
    blob: response.data,
    filename,
  }
}

/** Read effective export defaults from backend config. */
export async function fetchExportConfig(signal?: AbortSignal): Promise<ExportConfig> {
  const { data } = await apiClient.get<ExportConfig>(CONFIG_BASE, { signal })
  return data
}

/** Persist partial export-default updates. */
export async function patchExportDefaults(
  payload: ExportDefaultsUpdateRequest,
): Promise<ExportDefaultsPatchResponse> {
  const { data } = await apiClient.patch<ExportDefaultsPatchResponse>(
    `${CONFIG_BASE}/defaults`,
    payload,
  )
  return data
}

/** Remove persisted export defaults and fallback to server built-ins. */
export async function deleteExportDefaults(): Promise<void> {
  await apiClient.delete(`${CONFIG_BASE}/defaults`)
}
