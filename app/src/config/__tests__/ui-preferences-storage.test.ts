// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createUiPreferencesRepository } from '../ui-preferences-storage'
import { DEFAULT_UI_PREFERENCES, UI_PREFERENCES_STORAGE_KEY } from '../ui-preferences'

describe('ui-preferences-storage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('loads defaults when no persisted preferences exist', async () => {
    const repository = createUiPreferencesRepository()

    await expect(repository.load()).resolves.toEqual(DEFAULT_UI_PREFERENCES)
  })

  it('migrates legacy localStorage keys into the unified preferences shape', async () => {
    window.localStorage.setItem('nola-language', 'zh')
    window.localStorage.setItem('nola-theme', 'dark')
    window.localStorage.setItem('nola-units', 'imperial')

    const repository = createUiPreferencesRepository()

    await expect(repository.load()).resolves.toEqual({
      version: 1,
      language: 'zh',
      hasExplicitLanguagePreference: true,
      theme: 'dark',
      units: 'imperial',
    })
  })

  it('falls back to legacy preferences when the unified payload is corrupt', async () => {
    window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, '{')
    window.localStorage.setItem('nola-language', 'zh')

    const repository = createUiPreferencesRepository()

    await expect(repository.load()).resolves.toEqual({
      ...DEFAULT_UI_PREFERENCES,
      language: 'zh',
      hasExplicitLanguagePreference: true,
    })
  })

  it('prefers the unified payload over legacy keys', async () => {
    window.localStorage.setItem(
      UI_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        language: 'zh',
        hasExplicitLanguagePreference: true,
        theme: 'light',
        units: 'imperial',
      }),
    )
    window.localStorage.setItem('nola-language', 'en')
    window.localStorage.setItem('nola-theme', 'dark')
    window.localStorage.setItem('nola-units', 'metric')

    const repository = createUiPreferencesRepository()

    await expect(repository.load()).resolves.toEqual({
      version: 1,
      language: 'zh',
      hasExplicitLanguagePreference: true,
      theme: 'light',
      units: 'imperial',
    })
  })

  it('migrates partial legacy preferences while leaving unstored values at defaults', async () => {
    window.localStorage.setItem('nola-language', 'zh')

    const repository = createUiPreferencesRepository()

    await expect(repository.load()).resolves.toEqual({
      ...DEFAULT_UI_PREFERENCES,
      language: 'zh',
      hasExplicitLanguagePreference: true,
    })
  })

  it('normalizes malformed unified preferences back to defaults', async () => {
    window.localStorage.setItem(
      UI_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        language: 123,
        hasExplicitLanguagePreference: 'false',
        theme: 'neon',
        units: null,
      }),
    )

    const repository = createUiPreferencesRepository()

    await expect(repository.load()).resolves.toEqual(DEFAULT_UI_PREFERENCES)
  })

  it('stores the unified preferences payload under one key', async () => {
    const repository = createUiPreferencesRepository()

    await repository.save({
      version: 1,
      language: 'zh',
      hasExplicitLanguagePreference: true,
      theme: 'light',
      units: 'metric',
    })

    expect(window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)).toBe(
      JSON.stringify({
        version: 1,
        language: 'zh',
        hasExplicitLanguagePreference: true,
        theme: 'light',
        units: 'metric',
      }),
    )
    expect(window.localStorage.getItem('nola-language')).toBeNull()
    expect(window.localStorage.getItem('nola-theme')).toBeNull()
    expect(window.localStorage.getItem('nola-units')).toBeNull()
  })

  it('ignores browser storage write failures', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    const repository = createUiPreferencesRepository()

    await expect(
      repository.save({
        version: 1,
        language: 'zh',
        hasExplicitLanguagePreference: true,
        theme: 'light',
        units: 'metric',
      }),
    ).resolves.toBeUndefined()
  })
})
