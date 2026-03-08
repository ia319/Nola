import type { AppError } from '@/shared/types'

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error' | 'cancelled'

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
  startUpload: () => Promise<void>
  cancelUpload: (id: string) => void
  retryUpload: (id: string) => Promise<void>
  markTaskCreated: (fileId: string) => void
  reset: () => Promise<void>
  isUploading: boolean
  availableFileIds: string[]
  hasErrors: boolean
  batchError: AppError | null
  clearBatchError: () => void
}
