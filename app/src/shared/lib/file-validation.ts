import type { AppError } from '@/shared/types'
import { createValidationError } from './error-factory'

/**
 * File validation rules injected by callers.
 *
 * This module performs no input normalization — callers must pre-normalize:
 * extensions lowercase without leading dot, MIME types lowercase.
 */
export interface FileValidationConfig {
  allowedExtensions: readonly string[]
  allowedMimeTypes: readonly string[]
  maxFileSize: number
}

/** Result of a file validation check. */
export interface FileValidationResult {
  valid: boolean
  error?: AppError
}

/**
 * Extract the lowercase extension from a filename.
 *
 * Return `null` when the name has no dot or ends with a dot.
 */
function extractExtension(name: string): string | null {
  const lastDot = name.lastIndexOf('.')
  if (lastDot < 0 || lastDot === name.length - 1) return null
  return name.slice(lastDot + 1).toLowerCase()
}

/**
 * Validate a file against the provided config.
 *
 * Return early on the first failure so only one error is reported.
 *
 * @param file - Browser File object to validate.
 * @param config - Validation thresholds injected by the caller.
 * @returns `{ valid: true }` on success, or `{ valid: false, error }` with an AppError.
 */
export function validateFile(file: File, config: FileValidationConfig): FileValidationResult {
  const ext = extractExtension(file.name)

  // Reject files without an extension early — cannot match the allowlist
  if (ext === null) {
    return {
      valid: false,
      error: createValidationError('VALIDATION_NO_EXTENSION', 'upload.error.noExtension', {
        fileName: file.name,
      }),
    }
  }

  // Zero-byte files cannot be transcribed
  if (file.size === 0) {
    return {
      valid: false,
      error: createValidationError('VALIDATION_EMPTY_FILE', 'upload.error.emptyFile', {
        fileName: file.name,
      }),
    }
  }

  // Extension allowlist
  if (!config.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: createValidationError('VALIDATION_EXTENSION', 'upload.error.extensionNotAllowed', {
        ext,
        allowed: config.allowedExtensions.join(', '),
      }),
    }
  }

  // Skip MIME check when the browser leaves type empty (e.g. uncommon extensions)
  if (file.type && !config.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: createValidationError('VALIDATION_MIME', 'upload.error.mimeNotAllowed', {
        mime: file.type,
      }),
    }
  }

  // File size cap
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: createValidationError('VALIDATION_FILE_SIZE', 'upload.error.fileTooLarge', {
        maxSize: config.maxFileSize,
        actualSize: file.size,
      }),
    }
  }

  return { valid: true }
}
