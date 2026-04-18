import { useEffect } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { getLocaleFromPath, localizePath } from '@/app/locale/locale-routing'
import { useUiPreferencesStore } from '@/app/locale/ui-preferences-store'
import { normalizeUiLanguage } from '@/config/ui-preferences'

export function AppLocaleController() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const language = useUiPreferencesStore((state) => state.preferences.language)
  const hasExplicitLanguagePreference = useUiPreferencesStore(
    (state) => state.preferences.hasExplicitLanguagePreference,
  )
  const routeLocale = getLocaleFromPath(pathname)
  const effectiveLanguage = routeLocale ?? language

  useEffect(() => {
    const activeLanguage =
      normalizeUiLanguage(i18n.resolvedLanguage ?? i18n.language) ?? effectiveLanguage

    if (activeLanguage !== effectiveLanguage) {
      void i18n.changeLanguage(effectiveLanguage)
    }
  }, [effectiveLanguage, i18n])

  useEffect(() => {
    if (!hasExplicitLanguagePreference || routeLocale) {
      return
    }

    const localizedPath = localizePath(pathname, language)
    if (localizedPath === pathname) {
      return
    }

    void navigate({
      to: localizedPath,
      replace: true,
      search: true,
      hash: true,
    })
  }, [hasExplicitLanguagePreference, language, navigate, pathname, routeLocale])

  return null
}
