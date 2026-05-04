export const RUNTIME_ENVIRONMENTS = ['web', 'tauri'] as const

export type RuntimeEnvironment = (typeof RUNTIME_ENVIRONMENTS)[number]

type TauriWindow = Window & {
  __TAURI__?: unknown
  __TAURI_INTERNALS__?: unknown
}

function getRuntimeWindow(): TauriWindow | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window as TauriWindow
}

/** Return whether the app is running inside a Tauri WebView. */
export function isTauriRuntime(): boolean {
  const runtimeWindow = getRuntimeWindow()

  return Boolean(
    runtimeWindow && ('__TAURI__' in runtimeWindow || '__TAURI_INTERNALS__' in runtimeWindow),
  )
}

/** Return the current app runtime environment. */
export function getRuntimeEnvironment(): RuntimeEnvironment {
  return isTauriRuntime() ? 'tauri' : 'web'
}
