import { useCallback, useEffect, useRef, useState } from 'react'

import { deleteExportDefaults, fetchExportConfig, patchExportDefaults } from '@/features/export/api'
import type { ExportDefaults, ExportDefaultsUpdateRequest } from '@/shared/types'

const FALLBACK_EXPORT_DEFAULTS: ExportDefaults = {
  format: 'srt',
  include_timestamps: true,
}

export interface UseExportDefaultsResult {
  defaults: ExportDefaults
  isLoading: boolean
  refresh: () => Promise<ExportDefaults>
  updateDefaults: (payload: ExportDefaultsUpdateRequest) => Promise<ExportDefaults>
  resetDefaults: () => Promise<ExportDefaults>
}

/**
 * Keep export default-value resolution centralized for single-task and batch export flows.
 */
export function useExportDefaults(): UseExportDefaultsResult {
  const [defaults, setDefaults] = useState<ExportDefaults>(FALLBACK_EXPORT_DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const requestVersionRef = useRef(0)

  const refresh = useCallback(async (): Promise<ExportDefaults> => {
    const requestVersion = ++requestVersionRef.current
    const response = await fetchExportConfig()
    if (requestVersion === requestVersionRef.current) {
      setDefaults(response.defaults)
    }
    return response.defaults
  }, [])

  const updateDefaults = useCallback(
    async (payload: ExportDefaultsUpdateRequest): Promise<ExportDefaults> => {
      const requestVersion = ++requestVersionRef.current
      const response = await patchExportDefaults(payload)
      if (requestVersion === requestVersionRef.current) {
        setDefaults(response.defaults)
      }
      setIsLoading(false)
      return response.defaults
    },
    [],
  )

  const resetDefaults = useCallback(async (): Promise<ExportDefaults> => {
    const requestVersion = ++requestVersionRef.current
    await deleteExportDefaults()
    const response = await fetchExportConfig()
    if (requestVersion === requestVersionRef.current) {
      setDefaults(response.defaults)
    }
    setIsLoading(false)
    return response.defaults
  }, [])

  useEffect(() => {
    let active = true
    const requestVersion = ++requestVersionRef.current

    void (async () => {
      try {
        const response = await fetchExportConfig()
        if (active && requestVersion === requestVersionRef.current) {
          setDefaults(response.defaults)
        }
      } catch {
        // Keep fallback defaults when bootstrap fetch fails.
      } finally {
        if (active && requestVersion === requestVersionRef.current) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [])

  return {
    defaults,
    isLoading,
    refresh,
    updateDefaults,
    resetDefaults,
  }
}
