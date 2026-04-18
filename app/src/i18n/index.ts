/**
 * i18next initialization.
 *
 * Bundle locale files statically to keep the first paint deterministic.
 * Initialize the active language after the UI preferences store is hydrated.
 *
 * @see https://react.i18next.com/getting-started
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import type { UiLanguage } from '@/config/ui-preferences'
import { DEFAULT_UI_LANGUAGE } from '@/config/ui-preferences'
import en from './locales/en.json'
import zh from './locales/zh.json'

let initializationPromise: Promise<void> | null = null

export async function initializeI18n(language: UiLanguage): Promise<void> {
  if (initializationPromise) {
    await initializationPromise

    if (i18n.language !== language) {
      await i18n.changeLanguage(language)
    }
    return
  }

  initializationPromise = i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        zh: { translation: zh },
      },
      lng: language,
      fallbackLng: DEFAULT_UI_LANGUAGE,
      interpolation: {
        escapeValue: false,
      },
    })
    .then(() => undefined)

  await initializationPromise
}

export default i18n
