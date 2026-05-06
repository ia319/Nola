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
  const environment = options.environment ?? getRealtimeRuntimeEnvironment()

  if (environment === 'tauri') {
    const { createTauriRealtimeTransport } = await import('./tauri-realtime-transport')
    return createTauriRealtimeTransport()
  }

  const { createWebRealtimeTransport } = await import('./web-realtime-transport')
  return createWebRealtimeTransport(options)
}
