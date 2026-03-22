import { useCallback, useEffect, useState } from 'react'

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

  const refresh = useCallback(async (): Promise<ExportDefaults> => {
    const response = await fetchExportConfig()
    setDefaults(response.defaults)
    return response.defaults
  }, [])

  const updateDefaults = useCallback(
    async (payload: ExportDefaultsUpdateRequest): Promise<ExportDefaults> => {
      const response = await patchExportDefaults(payload)
      setDefaults(response.defaults)
      return response.defaults
    },
    [],
  )

  const resetDefaults = useCallback(async (): Promise<ExportDefaults> => {
    await deleteExportDefaults()
    return refresh()
  }, [refresh])

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const response = await fetchExportConfig()
        if (active) {
          setDefaults(response.defaults)
        }
      } catch {
        // Keep fallback defaults when bootstrap fetch fails.
      } finally {
        if (active) {
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
