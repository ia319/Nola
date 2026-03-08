import { validateFile, type FileValidationConfig } from '@/shared/lib/file-validation'
import { createValidationError } from '@/shared/lib/error-factory'
import type { AppError } from '@/shared/types'
import type { UploadItem } from '@/features/upload/types'

/**
 * Result of admitting a new batch into the upload queue.
 *
 * `batchError` is reserved for uploader-level feedback such as dedup skips,
 * while per-file validation stays attached to each UploadItem.
 */
export interface FileAdmissionResult {
  items: UploadItem[]
  batchError: AppError | null
}

/** Build a stable fingerprint so the same file is not queued twice. */
function fileFingerprint(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`
}

/** Create the initial queue item so validation stays outside the hook. */
function createUploadItem(file: File, validationConfig: FileValidationConfig): UploadItem {
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
}

/**
 * Admit a batch of files into the upload queue.
 *
 * Skip files already present in the queue, collapse duplicates within the same
 * selection, and preserve per-file validation for the accepted entries.
 *
 * @param files - Newly selected files from browse or drag-and-drop.
 * @param existingUploads - Current queue snapshot used for dedup checks.
 * @param validationConfig - File validation rules injected by the caller.
 * @returns Accepted queue items plus an optional uploader-level duplicate error.
 */
export function admitFiles(
  files: File[],
  existingUploads: UploadItem[],
  validationConfig: FileValidationConfig,
): FileAdmissionResult {
  const existingFingerprints = new Set(
    existingUploads.map((upload) => fileFingerprint(upload.file)),
  )
  const seen = new Set<string>()
  const accepted: File[] = []
  let skippedCount = 0

  for (const file of files) {
    const fingerprint = fileFingerprint(file)
    if (existingFingerprints.has(fingerprint) || seen.has(fingerprint)) {
      skippedCount += 1
      continue
    }

    seen.add(fingerprint)
    accepted.push(file)
  }

  return {
    items: accepted.map((file) => createUploadItem(file, validationConfig)),
    batchError:
      skippedCount > 0
        ? createValidationError('VALIDATION_DUPLICATE', 'upload.error.duplicateFiles', {
            count: skippedCount,
          })
        : null,
  }
}
