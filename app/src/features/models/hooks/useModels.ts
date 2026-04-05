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
  error: AppError | null
  refresh: () => Promise<void>
}

/**
 * Fetch model list on mount; expose `refresh` for imperative re-fetch
 * (e.g. after download completes or model selection changes).
 */
export function useModels(): UseModelsResult {
  const [data, setData] = useState<ModelListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AppError | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setIsLoading(true)
    setError(null)

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
      }
    }
  }, [])

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
    error,
    refresh,
  }
}
