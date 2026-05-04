// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_UI_PREFERENCES } from '../ui-preferences'

describe('ui-preferences-storage runtime selection', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/runtime-environment')
    vi.resetModules()
    window.localStorage.clear()
  })

  it('uses the shared app runtime helper when selecting the repository', async () => {
    const isTauriRuntime = vi.fn(() => true)
    vi.doMock('@/lib/runtime-environment', () => ({ isTauriRuntime }))

    const { createUiPreferencesRepository } = await import('../ui-preferences-storage')
    const repository = createUiPreferencesRepository()

    await expect(repository.load()).resolves.toEqual(DEFAULT_UI_PREFERENCES)
    expect(isTauriRuntime).toHaveBeenCalledTimes(1)
  })
})
