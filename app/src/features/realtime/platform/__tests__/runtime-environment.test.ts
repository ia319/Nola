import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getRuntimeEnvironment } from '@/lib/runtime-environment'

import { createRealtimeRuntimeAdapter, getRealtimeRuntimeEnvironment } from '../runtime-environment'

vi.mock('@/lib/runtime-environment', () => ({
  getRuntimeEnvironment: vi.fn(),
}))

const getRuntimeEnvironmentMock = vi.mocked(getRuntimeEnvironment)

describe('realtime runtime-environment', () => {
  beforeEach(() => {
    getRuntimeEnvironmentMock.mockClear()
    getRuntimeEnvironmentMock.mockReturnValue('web')
  })

  it('uses the shared app runtime environment', () => {
    getRuntimeEnvironmentMock.mockReturnValue('tauri')

    expect(getRealtimeRuntimeEnvironment()).toBe('tauri')
    expect(getRuntimeEnvironmentMock).toHaveBeenCalledTimes(1)
  })

  it('creates the web adapter for the web runtime', () => {
    const adapter = createRealtimeRuntimeAdapter({
      web: () => 'web-adapter',
      tauri: () => 'tauri-adapter',
    })

    expect(adapter).toBe('web-adapter')
  })

  it('creates the tauri adapter for the tauri runtime', () => {
    getRuntimeEnvironmentMock.mockReturnValue('tauri')

    const adapter = createRealtimeRuntimeAdapter({
      web: () => 'web-adapter',
      tauri: () => 'tauri-adapter',
    })

    expect(adapter).toBe('tauri-adapter')
  })

  it('allows callers to pass an explicit runtime for deterministic selection', () => {
    const adapter = createRealtimeRuntimeAdapter(
      {
        web: () => 'web-adapter',
        tauri: () => 'tauri-adapter',
      },
      'tauri',
    )

    expect(adapter).toBe('tauri-adapter')
    expect(getRuntimeEnvironmentMock).not.toHaveBeenCalled()
  })
})
