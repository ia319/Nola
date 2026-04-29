import type { UploadItem, UploadStatus } from '@/features/upload/types'

export type UploadsUpdater = UploadItem[] | ((prev: UploadItem[]) => UploadItem[])

/**
 * Update one upload item by id.
 */
export function patchUploadItem(
  uploads: UploadItem[],
  id: string,
  patch: Partial<UploadItem>,
): UploadItem[] {
  return uploads.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

/**
 * Remove one upload item by id.
 */
export function removeUploadItem(uploads: UploadItem[], id: string): UploadItem[] {
  return uploads.filter((item) => item.id !== id)
}

/**
 * Select uploads that can be started by an explicit queue action.
 */
export function selectStartableUploads(uploads: readonly UploadItem[]): UploadItem[] {
  return uploads.filter((item) => item.status === 'pending')
}

/**
 * Select uploads that still have an in-flight request to abort.
 */
export function selectCancellableUploads(uploads: readonly UploadItem[]): UploadItem[] {
  return uploads.filter((item) => item.status === 'uploading')
}

/**
 * Select uploads that can be retried without creating duplicate remote files.
 */
export function selectRetryableUploads(uploads: readonly UploadItem[]): UploadItem[] {
  return uploads.filter((item) => item.status === 'error' || item.status === 'cancelled')
}

/**
 * Select uploads that can be removed from the local queue.
 */
export function selectRemovableUploads(uploads: readonly UploadItem[]): UploadItem[] {
  return uploads.filter((item) => item.status !== 'uploading')
}

export const UPLOAD_STATUS_SORT_ORDER: Record<UploadStatus, number> = {
  pending: 0,
  uploading: 1,
  error: 2,
  cancelled: 3,
  success: 4,
}

/**
 * Select file ids that are uploaded but not yet attached to a task.
 */
export function selectAvailableFileIds(uploads: UploadItem[]): string[] {
  return uploads
    .filter((item) => item.status === 'success' && !item.taskCreated && item.fileId)
    .map((item) => item.fileId!)
}

/**
 * Whether any file is currently uploading.
 */
export function selectIsUploading(uploads: UploadItem[]): boolean {
  return uploads.some((item) => item.status === 'uploading')
}

/**
 * Whether any file is in error state.
 */
export function selectHasErrors(uploads: UploadItem[]): boolean {
  return uploads.some((item) => item.status === 'error')
}
