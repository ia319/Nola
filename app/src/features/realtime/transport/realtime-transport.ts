import type { RealtimeRuntimeEnvironment } from '../platform/runtime-environment'
import { getRealtimeRuntimeEnvironment } from '../platform/runtime-environment'
import type { LiveRealtimeTransport } from './types'
import type { WebLiveRealtimeTransportOptions } from './web-realtime-transport'

export interface CreateRealtimeTransportOptions extends WebLiveRealtimeTransportOptions {
  environment?: RealtimeRuntimeEnvironment
}

export async function createRealtimeTransport(
  options: CreateRealtimeTransportOptions = {},
): Promise<LiveRealtimeTransport> {
  const { environment: configuredEnvironment, ...webTransportOptions } = options
  const environment = configuredEnvironment ?? getRealtimeRuntimeEnvironment()
  const { createWebRealtimeTransport } = await import('./web-realtime-transport')

  if (environment === 'tauri') {
    return createWebRealtimeTransport(webTransportOptions)
  }

  return createWebRealtimeTransport(webTransportOptions)
}
