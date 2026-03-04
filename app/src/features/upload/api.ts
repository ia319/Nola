import apiClient from '@/shared/lib/api-client'
import type {
  DeleteResponse,
  FileInfo,
  FileListResponse,
  FileUploadResponse,
  IntegrityCheckResponse,
} from '@/shared/types'

const BASE = '/api/files'

/**
 * Upload an audio file with progress tracking.
 *
 * @param file - Audio file to upload.
 * @param onProgress - Progress callback receiving 0-100 percent.
 * @param signal - AbortSignal for cancellation.
 * @param timeoutMs - Per-request timeout override (default: global 30s).
 * @returns Upload response containing the `file_id`.
 */
export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<FileUploadResponse> {
  const form = new FormData()
  form.append('file', file)

  const { data } = await apiClient.post<FileUploadResponse>(BASE + '/', form, {
    signal,
    timeout: timeoutMs,
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return data
}

/** List uploaded files with pagination. */
export async function listFiles(
  params: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<FileListResponse> {
  const { data } = await apiClient.get<FileListResponse>(BASE + '/', {
    params,
    signal,
  })
  return data
}

/** Get single file metadata by ID. */
export async function getFile(fileId: string): Promise<FileInfo> {
  const { data } = await apiClient.get<FileInfo>(`${BASE}/${fileId}`)
  return data
}

/** Delete a file and its associated data. */
export async function deleteFile(fileId: string): Promise<DeleteResponse> {
  const { data } = await apiClient.delete<DeleteResponse>(`${BASE}/${fileId}`)
  return data
}

/** Check database-file consistency. */
export async function checkIntegrity(): Promise<IntegrityCheckResponse> {
  const { data } = await apiClient.get<IntegrityCheckResponse>(BASE + '/check-integrity')
  return data
}
