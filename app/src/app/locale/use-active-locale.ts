import { useLocation } from '@tanstack/react-router'

import { useUiPreferencesStore } from './ui-preferences-store'
import { getLocaleFromPath } from './locale-routing'

export function useActiveLocale() {
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const language = useUiPreferencesStore((state) => state.preferences.language)
  const hasExplicitLanguagePreference = useUiPreferencesStore(
    (state) => state.preferences.hasExplicitLanguagePreference,
  )

  return getLocaleFromPath(pathname) ?? (hasExplicitLanguagePreference ? language : null)
}
