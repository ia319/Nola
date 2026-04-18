// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import { createUiPreferencesRepository } from '../ui-preferences-storage'
import { DEFAULT_UI_PREFERENCES, UI_PREFERENCES_STORAGE_KEY } from '../ui-preferences'

describe('ui-preferences-storage', () => {
  afterEach(() => {
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
})
