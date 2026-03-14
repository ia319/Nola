import { useEffect, useSyncExternalStore } from 'react'

import type { AppConfig } from '@/shared/types'
import type { FileValidationConfig } from '@/shared/lib/file-validation'
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './constants'
import { fetchAppConfig } from './api'
import logger from './logger'

const FALLBACK_VALIDATION_CONFIG: FileValidationConfig = {
  allowedExtensions: [...ALLOWED_EXTENSIONS],
  allowedMimeTypes: [...ALLOWED_MIME_TYPES],
  maxFileSize: MAX_FILE_SIZE,
}

let cachedConfig: AppConfig | null = null
let fetchPromise: Promise<AppConfig> | null = null
let isFetching = false
let hasSettledInitialFetch = false
const subscribers = new Set<() => void>()
let storeSnapshot: AppConfigSnapshot = {
  config: null,
  isLoading: true,
}

interface AppConfigSnapshot {
  config: AppConfig | null
  isLoading: boolean
}

function emitStoreChange(): void {
  subscribers.forEach((subscriber) => subscriber())
}

function subscribeStore(subscriber: () => void): () => void {
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
  }
}

function getStoreSnapshot(): AppConfigSnapshot {
  return storeSnapshot
}

function updateStoreSnapshot(): void {
  const nextIsLoading = isFetching || (!hasSettledInitialFetch && cachedConfig === null)
  const nextConfig = cachedConfig

  if (storeSnapshot.config === nextConfig && storeSnapshot.isLoading === nextIsLoading) {
    return
  }

  storeSnapshot = {
    config: nextConfig,
    isLoading: nextIsLoading,
  }
  emitStoreChange()
}

function getOrFetchConfig(forceRefresh = false): Promise<AppConfig> {
  if (fetchPromise) return fetchPromise
  if (!forceRefresh && cachedConfig) return Promise.resolve(cachedConfig)

  isFetching = true
  updateStoreSnapshot()

  fetchPromise = fetchAppConfig()
    .then((config) => {
      cachedConfig = config
      updateStoreSnapshot()
      return config
    })
    .catch((err) => {
      if (cachedConfig) {
        logger.warn('Failed to refresh app config, keeping cached values', err)
      } else {
        logger.warn('Failed to fetch app config, using fallback constants', err)
      }
      throw err
    })
    .finally(() => {
      fetchPromise = null
      isFetching = false
      hasSettledInitialFetch = true
      updateStoreSnapshot()
    })

  return fetchPromise
}

export interface UseAppConfigReturn {
  config: AppConfig | null
  fileValidationConfig: FileValidationConfig
  isLoading: boolean
}

/** Fetch and cache app config from `GET /api/config`. */
export function useAppConfig(): UseAppConfigReturn {
  const snapshot = useSyncExternalStore(subscribeStore, getStoreSnapshot, getStoreSnapshot)

  useEffect(() => {
    void getOrFetchConfig().catch(() => undefined)
  }, [])

  const fileValidationConfig: FileValidationConfig = snapshot.config
    ? {
        allowedExtensions: snapshot.config.file.allowed_extensions.map((ext) =>
          (ext.startsWith('.') ? ext.slice(1) : ext).toLowerCase(),
        ),
        allowedMimeTypes: snapshot.config.file.allowed_mime_types.map((m) => m.toLowerCase()),
        maxFileSize: snapshot.config.file.max_file_size,
      }
    : FALLBACK_VALIDATION_CONFIG

  return {
    config: snapshot.config,
    fileValidationConfig,
    isLoading: snapshot.isLoading,
  }
}

/** Force a network refetch and replace the shared config snapshot. */
export async function refreshAppConfig(): Promise<AppConfig> {
  return getOrFetchConfig(true)
}

/** Reset module-level cache in tests. */
export function _resetConfigCache(): void {
  cachedConfig = null
  fetchPromise = null
  isFetching = false
  hasSettledInitialFetch = false
  storeSnapshot = {
    config: null,
    isLoading: true,
  }
  emitStoreChange()
}
