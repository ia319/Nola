import type { UploadItem } from '@/features/upload/types'

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
