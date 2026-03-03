/**
 * i18next initialization.
 *
 * Bundles locale files statically to avoid async loading latency.
 * Default language is English, matching open-source project convention.
 *
 * @see https://react.i18next.com/getting-started
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import zh from './locales/zh.json'

// NOTE: Static bundled resources keep initialization predictable in current scope.
// Revisit bootstrap coordination (await init or Suspense) if resources become async.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    // React already escapes rendered output, double-escaping breaks templates
    escapeValue: false,
  },
})

export default i18n
