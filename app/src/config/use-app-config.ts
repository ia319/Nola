import { useEffect, useState } from 'react'

import type { AppConfig } from '@/shared/types'
import type { FileValidationConfig } from '@/shared/lib/file-validation'
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './constants'
import { fetchAppConfig } from './api'
import logger from './logger'

/** Fallback validation config derived from hardcoded constants. */
const FALLBACK_VALIDATION_CONFIG: FileValidationConfig = {
  allowedExtensions: [...ALLOWED_EXTENSIONS],
  allowedMimeTypes: [...ALLOWED_MIME_TYPES],
  maxFileSize: MAX_FILE_SIZE,
}

// ---------------------------------------------------------------------------
// Module-level singleton: the fetch runs once and is shared across all callers.
// No AbortSignal — config is an app-level resource whose lifecycle is not
// tied to any React component.
// ---------------------------------------------------------------------------

let cachedConfig: AppConfig | null = null
let fetchPromise: Promise<AppConfig> | null = null

function getOrFetchConfig(): Promise<AppConfig> {
  if (cachedConfig) return Promise.resolve(cachedConfig)
  if (fetchPromise) return fetchPromise

  fetchPromise = fetchAppConfig()
    .then((config) => {
      cachedConfig = config
      return config
    })
    .catch((err) => {
      // Allow retry on next hook mount if this attempt fails.
      fetchPromise = null
      throw err
    })

  return fetchPromise
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export interface UseAppConfigReturn {
  /** Fetched config, or null while loading / on failure. */
  config: AppConfig | null
  /** Validation config derived from fetched config, or fallback constants. */
  fileValidationConfig: FileValidationConfig
  /** True while the initial fetch is in-flight. */
  isLoading: boolean
}

/**
 * Fetch and cache the application config from `GET /api/config`.
 *
 * Multiple callers share one fetch; the result is cached at module level
 * so remounts do not trigger additional requests. When the fetch fails,
 * `fileValidationConfig` falls back to the hardcoded constants.
 *
 * The fetch intentionally has no AbortSignal — config is an app-level
 * singleton resource that should never be cancelled by component unmount.
 * The `active` flag only guards against setState on unmounted components.
 */
export function useAppConfig(): UseAppConfigReturn {
  const [config, setConfig] = useState<AppConfig | null>(() => cachedConfig)
  const [isLoading, setIsLoading] = useState(() => cachedConfig === null)

  useEffect(() => {
    let active = true

    getOrFetchConfig()
      .then((data) => {
        if (active) {
          setConfig(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          logger.warn('Failed to fetch app config, using fallback constants', err)
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  // Derive FileValidationConfig from the fetched config or fall back.
  const fileValidationConfig: FileValidationConfig = config
    ? {
        allowedExtensions: config.file.allowed_extensions.map((ext) =>
          ext.startsWith('.') ? ext.slice(1) : ext,
        ),
        allowedMimeTypes: config.file.allowed_mime_types,
        maxFileSize: config.file.max_file_size,
      }
    : FALLBACK_VALIDATION_CONFIG

  return { config, fileValidationConfig, isLoading }
}

// ---------------------------------------------------------------------------
// Test helpers (only available via explicit import in test files)
// ---------------------------------------------------------------------------

/** Reset the module-level cache. Call in `beforeEach` / `afterEach`. */
export function _resetConfigCache(): void {
  cachedConfig = null
  fetchPromise = null
}
