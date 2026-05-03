import { afterEach, describe, expect, it, vi } from 'vitest'

import { getRuntimeEnvironment, isTauriRuntime } from '../runtime-environment'

describe('runtime-environment', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns web when window is unavailable', () => {
    vi.stubGlobal('window', undefined)

    expect(isTauriRuntime()).toBe(false)
    expect(getRuntimeEnvironment()).toBe('web')
  })

  it('returns web in a browser runtime without Tauri globals', () => {
    vi.stubGlobal('window', {})

    expect(isTauriRuntime()).toBe(false)
    expect(getRuntimeEnvironment()).toBe('web')
  })

  it('returns tauri when the public Tauri global exists', () => {
    vi.stubGlobal('window', { __TAURI__: {} })

    expect(isTauriRuntime()).toBe(true)
    expect(getRuntimeEnvironment()).toBe('tauri')
  })

  it('returns tauri when the internal Tauri global exists', () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })

    expect(isTauriRuntime()).toBe(true)
    expect(getRuntimeEnvironment()).toBe('tauri')
  })
})
