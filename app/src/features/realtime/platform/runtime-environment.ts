import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'

export type RealtimeRuntimeEnvironment = RuntimeEnvironment

export interface RealtimeRuntimeAdapterFactory<TAdapter> {
  web: () => TAdapter
  tauri: () => TAdapter
}

/** Return the runtime environment used by realtime adapters. */
export function getRealtimeRuntimeEnvironment(): RealtimeRuntimeEnvironment {
  return getRuntimeEnvironment()
}

/** Create the realtime adapter implementation for the active runtime. */
export function createRealtimeRuntimeAdapter<TAdapter>(
  factory: RealtimeRuntimeAdapterFactory<TAdapter>,
  environment: RealtimeRuntimeEnvironment = getRealtimeRuntimeEnvironment(),
): TAdapter {
  return environment === 'tauri' ? factory.tauri() : factory.web()
}
