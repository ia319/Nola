import type { AppConfig } from '@/shared/types'
import { queryClient } from '@/shared/lib/query-client'
import { queryKeys } from '@/shared/lib/query-keys'

import { refreshAppConfig } from './use-app-config'

export async function refreshConfigCaches(): Promise<AppConfig> {
  const config = await refreshAppConfig()
  await queryClient.invalidateQueries({ queryKey: queryKeys.config.all })
  return config
}
