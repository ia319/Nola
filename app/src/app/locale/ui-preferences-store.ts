import { create } from 'zustand'

import {
  createUiPreferencesRepository,
  type UiPreferencesRepository,
} from '@/config/ui-preferences-storage'
import {
  DEFAULT_UI_PREFERENCES,
  normalizeUiPreferences,
  type UiLanguage,
  type UiPreferences,
  type UiTheme,
  type UiUnits,
} from '@/config/ui-preferences'

interface UiPreferencesStoreState {
  preferences: UiPreferences
  isHydrated: boolean
  hydrate: () => Promise<UiPreferences>
  setLanguage: (language: UiLanguage, hasExplicitLanguagePreference?: boolean) => Promise<void>
  setTheme: (theme: UiTheme) => Promise<void>
  setUnits: (units: UiUnits) => Promise<void>
}

const repository: UiPreferencesRepository = createUiPreferencesRepository()
let hydrationPromise: Promise<UiPreferences> | null = null

async function persistPreferences(next: UiPreferences): Promise<void> {
  await repository.save(next)
}

export const useUiPreferencesStore = create<UiPreferencesStoreState>((set, get) => ({
  preferences: DEFAULT_UI_PREFERENCES,
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) {
      return get().preferences
    }

    if (!hydrationPromise) {
      hydrationPromise = repository
        .load()
        .then((loaded) => {
          const loadedPreferences = normalizeUiPreferences(loaded)
          set({
            preferences: loadedPreferences,
            isHydrated: true,
          })

          return loadedPreferences
        })
        .finally(() => {
          hydrationPromise = null
        })
    }

    return hydrationPromise
  },

  setLanguage: async (language, hasExplicitLanguagePreference = true) => {
    if (!get().isHydrated) {
      await get().hydrate()
    }

    const nextPreferences = normalizeUiPreferences({
      ...get().preferences,
      language,
      hasExplicitLanguagePreference,
    })

    set({ preferences: nextPreferences })
    await persistPreferences(nextPreferences)
  },

  setTheme: async (theme) => {
    if (!get().isHydrated) {
      await get().hydrate()
    }

    const nextPreferences = normalizeUiPreferences({
      ...get().preferences,
      theme,
    })

    set({ preferences: nextPreferences })
    await persistPreferences(nextPreferences)
  },

  setUnits: async (units) => {
    if (!get().isHydrated) {
      await get().hydrate()
    }

    const nextPreferences = normalizeUiPreferences({
      ...get().preferences,
      units,
    })

    set({ preferences: nextPreferences })
    await persistPreferences(nextPreferences)
  },
}))

export async function hydrateUiPreferences(): Promise<UiPreferences> {
  return useUiPreferencesStore.getState().hydrate()
}
