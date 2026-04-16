import { useCallback, useEffect, useRef, useState } from 'react'

import { isAppError } from '@/shared/lib/error-factory'
import type { AppError } from '@/shared/types'

import { listModels } from '../api'
import type { ModelListResponse, ModelResponse } from '../types'

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

export interface UseModelsResult {
  models: ModelResponse[]
  configuredModelId: string | null
  lastLoadedModelId: string | null
  effectiveModelDir: string
  isLoading: boolean
  isRefreshing: boolean
  hasLoaded: boolean
  error: AppError | null
  refresh: () => Promise<void>
  updateSnapshot: (updater: (current: ModelListResponse) => ModelListResponse) => void
}

/**
 * Fetch model list on mount; expose `refresh` for imperative re-fetch
 * (e.g. after download completes or model selection changes).
 */
export function useModels(): UseModelsResult {
  const [data, setData] = useState<ModelListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const dataRef = useRef<ModelListResponse | null>(null)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const refresh = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    const hasSnapshot = dataRef.current !== null

    setError(null)
    // Keep the last successful snapshot visible during follow-up refreshes so
    // model actions update in place instead of dropping the whole page to loading.
    if (hasSnapshot) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const response = await listModels(controller.signal)
      if (!controller.signal.aborted) {
        setData(response)
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      setError(toAppError(err))
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [])

  const updateSnapshot = useCallback(
    (updater: (current: ModelListResponse) => ModelListResponse) => {
      setData((current) => (current === null ? current : updater(current)))
    },
    [],
  )

  useEffect(() => {
    void refresh()
    return () => {
      controllerRef.current?.abort()
    }
  }, [refresh])

  return {
    models: data?.models ?? [],
    configuredModelId: data?.configured_model_id ?? null,
    lastLoadedModelId: data?.last_loaded_model_id ?? null,
    effectiveModelDir: data?.effective_model_dir ?? '',
    isLoading,
    isRefreshing,
    hasLoaded: data !== null,
    error,
    refresh,
    updateSnapshot,
  }
}
