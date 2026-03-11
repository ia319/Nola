import apiClient from '@/shared/lib/api-client'
import type { AppConfig } from '@/shared/types'

/** Fetch the aggregated application configuration from `GET /api/config`. */
export async function fetchAppConfig(signal?: AbortSignal): Promise<AppConfig> {
  const { data } = await apiClient.get<AppConfig>('/api/config', { signal })
  return data
}
