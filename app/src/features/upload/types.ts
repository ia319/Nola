import type { AppError } from '@/shared/types'

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error' | 'cancelled'

export type UploadQueueSortBy = 'filename' | 'status' | 'size' | 'progress'

export interface UploadItem {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error: AppError | null
  fileId: string | null
  taskCreated: boolean
}

export interface UseFileUploadReturn {
  uploads: UploadItem[]
  addFiles: (files: File[]) => void
  removeFile: (id: string) => Promise<void>
  removeFiles: (ids: readonly string[]) => Promise<void>
  startUploads: (ids: readonly string[]) => Promise<void>
  cancelUpload: (id: string) => void
  cancelUploads: (ids: readonly string[]) => void
  retryUpload: (id: string) => Promise<void>
  retryUploads: (ids: readonly string[]) => Promise<void>
  markTaskCreated: (fileId: string) => void
  reset: () => Promise<void>
  isUploading: boolean
  /**
   * Keep the all-ready-file entry for legacy callers; the workbench now passes
   * selected ready files into task creation.
   */
  availableFileIds: string[]
  hasErrors: boolean
  batchError: AppError | null
  clearBatchError: () => void
}
