import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { validateFile, type FileValidationConfig } from '@/shared/lib/file-validation'
import { createNetworkError } from '@/shared/lib/error-factory'
import { uploadFile, deleteFile } from '@/features/upload/api'
import type { UploadItem, UseFileUploadReturn } from '@/features/upload/types'
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
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  UPLOAD_CONCURRENCY,
} from '@/config/constants'
import logger from '@/config/logger'

const validationConfig: FileValidationConfig = {
  allowedExtensions: [...ALLOWED_EXTENSIONS],
  allowedMimeTypes: [...ALLOWED_MIME_TYPES],
  maxFileSize: MAX_FILE_SIZE,
}

/**
 * Manage multi-file upload lifecycle.
 *
 * @returns Upload state and actions conforming to AD-4 multi-file architecture.
 */
export function useFileUpload(): UseFileUploadReturn {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const controllersRef = useRef<Map<string, AbortController>>(new Map())
  const lockRef = useRef(false)

  // Mirror state into a ref to support synchronous reads during async queue processing.
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

  const addFiles = useCallback(
    (files: File[]) => {
      const newItems: UploadItem[] = files.map((file) => {
        const result = validateFile(file, validationConfig)
        return {
          id: crypto.randomUUID(),
          file,
          status: result.valid ? 'pending' : 'error',
          progress: 0,
          error: result.valid ? null : (result.error ?? null),
          fileId: null,
          taskCreated: false,
        } satisfies UploadItem
      })
      setUploadsSync((prev) => [...prev, ...newItems])
    },
    [setUploadsSync],
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

      const timeoutMs = computeUploadTimeoutMs(item.file.size)

      try {
        const result = await uploadFile(
          item.file,
          (percent) => updateItem(id, { progress: percent }),
          controller.signal,
          timeoutMs,
        )
        controllersRef.current.delete(id)
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

      if (target.status === 'uploading') {
        const controller = controllersRef.current.get(id)
        if (controller) {
          controller.abort()
          controllersRef.current.delete(id)
        }
      }

      if (target.status === 'success' && !target.taskCreated && target.fileId) {
        try {
          await deleteFile(target.fileId)
        } catch {
          logger.warn(`deleteFile failed for ${target.fileId}, local entry removed regardless`)
        }
      }

      setUploadsSync((prev) => removeUploadItem(prev, id))
    },
    [setUploadsSync],
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

    const orphans = uploadsRef.current.filter(
      (u) => u.status === 'success' && !u.taskCreated && u.fileId,
    )

    await Promise.all(
      orphans.map(async (u) => {
        try {
          await deleteFile(u.fileId!)
        } catch {
          logger.warn(`deleteFile failed for ${u.fileId}, local entry removed regardless`)
        }
      }),
    )

    setUploadsSync([])
  }, [setUploadsSync])

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
  }
}
