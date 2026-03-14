import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileValidationConfig } from '@/shared/lib/file-validation'
import { createNetworkError } from '@/shared/lib/error-factory'
import type { AppError } from '@/shared/types'
import { uploadFile, deleteFile } from '@/features/upload/api'
import type { UploadItem, UseFileUploadReturn } from '@/features/upload/types'
import { admitFiles } from '@/features/upload/lib/admission'
import { computeUploadTimeoutMs } from '@/features/upload/lib/timeout'
import { isUploadCanceledError } from '@/features/upload/lib/error'
import {
  patchUploadItem,
  removeUploadItem,
  selectAvailableFileIds,
  selectHasErrors,
  selectIsUploading,
  type UploadsUpdater,
} from '@/features/upload/lib/state'
import { UPLOAD_CONCURRENCY } from '@/config/constants'
import logger from '@/config/logger'

/**
 * Manage multi-file upload lifecycle.
 *
 * @param validationConfig - File validation rules injected by the caller
 *   (derived from runtime app config or fallback constants).
 * @returns Upload state and actions conforming to AD-4 multi-file architecture.
 */
export function useFileUpload(validationConfig: FileValidationConfig): UseFileUploadReturn {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [batchError, setBatchError] = useState<AppError | null>(null)
  const controllersRef = useRef<Map<string, AbortController>>(new Map())
  const lockRef = useRef(false)

  const uploadsRef = useRef<UploadItem[]>([])
  const setUploadsSync = useCallback((updater: UploadsUpdater) => {
    const next = typeof updater === 'function' ? updater(uploadsRef.current) : updater
    uploadsRef.current = next
    setUploads(next)
  }, [])

  const updateItem = useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      setUploadsSync((prev) => patchUploadItem(prev, id, patch))
    },
    [setUploadsSync],
  )

  /**
   * Treat remote cleanup as best-effort so local queue actions are not blocked
   * by transient delete failures; backend TTL handles leftovers.
   */
  const deleteRemoteFileQuietly = useCallback(async (fileId: string) => {
    try {
      await deleteFile(fileId)
    } catch {
      logger.warn(`deleteFile failed for ${fileId}, local entry removed regardless`)
    }
  }, [])

  const addFiles = useCallback(
    (files: File[]) => {
      setBatchError(null)

      const { items, batchError } = admitFiles(files, uploadsRef.current, validationConfig)
      if (batchError) setBatchError(batchError)
      if (items.length === 0) return

      logger.info('upload.filesAdded', {
        accepted: items.filter((i) => i.status === 'pending').length,
        rejected: items.filter((i) => i.status === 'error').length,
      })

      setUploadsSync((prev) => [...prev, ...items])
    },
    [setUploadsSync, validationConfig],
  )

  const cancelUpload = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id)
      if (controller) {
        controller.abort()
        controllersRef.current.delete(id)
      }
      updateItem(id, { status: 'cancelled', progress: 0 })
    },
    [updateItem],
  )

  const uploadSingleFile = useCallback(
    async (id: string) => {
      const item = uploadsRef.current.find((u) => u.id === id)
      if (!item || item.status !== 'pending') return

      const controller = new AbortController()
      controllersRef.current.set(id, controller)
      updateItem(id, { status: 'uploading', progress: 0 })

      logger.info('upload.start', { fileName: item.file.name, fileSize: item.file.size })

      const timeoutMs = computeUploadTimeoutMs(item.file.size)

      try {
        const result = await uploadFile(
          item.file,
          (percent) => updateItem(id, { progress: percent }),
          controller.signal,
          timeoutMs,
        )
        controllersRef.current.delete(id)
        logger.info('upload.complete', { fileId: result.file_id, fileName: item.file.name })
        updateItem(id, {
          status: 'success',
          progress: 100,
          fileId: result.file_id,
        })
      } catch (err) {
        controllersRef.current.delete(id)

        // Cancelled requests should keep cancelled state set by cancelUpload.
        if (isUploadCanceledError(err)) return

        const appError = createNetworkError('UPLOAD_FAILED', 'upload.error.uploadFailed')
        logger.error('upload.failed', { fileName: item.file.name, error: err })
        updateItem(id, { status: 'error', error: appError })
      }
    },
    [updateItem],
  )

  const startUpload = useCallback(async () => {
    if (lockRef.current) return
    lockRef.current = true

    try {
      // Drain pending uploads with fixed-size batches; retries added mid-run are picked up next loop.
      while (true) {
        const pendingIds = uploadsRef.current.filter((u) => u.status === 'pending').map((u) => u.id)
        if (pendingIds.length === 0) break

        for (let i = 0; i < pendingIds.length; i += UPLOAD_CONCURRENCY) {
          const batch = pendingIds.slice(i, i + UPLOAD_CONCURRENCY)
          await Promise.all(batch.map((id) => uploadSingleFile(id)))
        }
      }
    } finally {
      lockRef.current = false
    }
  }, [uploadSingleFile])

  const removeFile = useCallback(
    async (id: string) => {
      const target = uploadsRef.current.find((u) => u.id === id)
      if (!target) return

      // NOTE: Snapshot-based status check has a theoretical race with in-flight upload
      // completion. If the upload succeeds between this read and the abort() call below,
      // the remote file won't be cleaned up here. Backend TTL/cleanup handles this edge case.

      if (target.status === 'uploading') {
        const controller = controllersRef.current.get(id)
        if (controller) {
          controller.abort()
          controllersRef.current.delete(id)
        }
      }

      if (target.status === 'success' && !target.taskCreated && target.fileId) {
        await deleteRemoteFileQuietly(target.fileId)
      }

      setUploadsSync((prev) => removeUploadItem(prev, id))
    },
    [deleteRemoteFileQuietly, setUploadsSync],
  )

  const retryUpload = useCallback(
    async (id: string) => {
      const item = uploadsRef.current.find((u) => u.id === id)
      if (!item || (item.status !== 'error' && item.status !== 'cancelled')) return

      updateItem(id, { status: 'pending', error: null, progress: 0 })
      controllersRef.current.delete(id)

      if (!lockRef.current) await startUpload()
    },
    [updateItem, startUpload],
  )

  const markTaskCreated = useCallback(
    (fileId: string) => {
      setUploadsSync((prev) =>
        prev.map((u) => (u.fileId === fileId ? { ...u, taskCreated: true } : u)),
      )
    },
    [setUploadsSync],
  )

  const reset = useCallback(async () => {
    controllersRef.current.forEach((c) => c.abort())
    controllersRef.current.clear()

    // NOTE: An in-flight upload that wins the abort race may write its fileId
    // after this snapshot, leaving the remote file uncleaned. Backend TTL
    // handles this edge case (same race as removeFile).
    const orphans = uploadsRef.current.filter(
      (u) => u.status === 'success' && !u.taskCreated && u.fileId,
    )

    await Promise.all(
      orphans.map(async (u) => {
        await deleteRemoteFileQuietly(u.fileId!)
      }),
    )

    setUploadsSync([])
    setBatchError(null)
  }, [deleteRemoteFileQuietly, setUploadsSync])

  const isUploading = useMemo(() => selectIsUploading(uploads), [uploads])
  const availableFileIds = useMemo(() => selectAvailableFileIds(uploads), [uploads])
  const hasErrors = useMemo(() => selectHasErrors(uploads), [uploads])

  useEffect(() => {
    const controllers = controllersRef.current
    return () => {
      controllers.forEach((c) => c.abort())
      controllers.clear()
    }
  }, [])

  const clearBatchError = useCallback(() => {
    setBatchError(null)
  }, [])

  return {
    uploads,
    addFiles,
    removeFile,
    startUpload,
    cancelUpload,
    retryUpload,
    markTaskCreated,
    reset,
    isUploading,
    availableFileIds,
    hasErrors,
    batchError,
    clearBatchError,
  }
}
