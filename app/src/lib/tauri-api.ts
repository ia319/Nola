import { getRuntimeEnvironment } from './runtime-environment'

export type NativeAudioSupportStatus = 'not_implemented' | 'unsupported' | 'available'

export interface DesktopRuntimeInfo {
  platform: string
  appVersion: string
  nativeAudioSupport: NativeAudioSupportStatus
}

export type TauriCommandArgs = Record<string, unknown>

/** Invoke a Tauri command only after the desktop runtime is detected. */
export async function invokeTauriCommand<TResponse>(
  command: string,
  args?: TauriCommandArgs,
): Promise<TResponse> {
  if (getRuntimeEnvironment() !== 'tauri') {
    throw new Error('Tauri commands are unavailable outside the desktop runtime')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<TResponse>(command, args)
}

/** Fetch static desktop runtime capabilities from the Tauri shell. */
export function getDesktopRuntimeInfo(): Promise<DesktopRuntimeInfo> {
  return invokeTauriCommand<DesktopRuntimeInfo>('desktop_runtime_info')
}
