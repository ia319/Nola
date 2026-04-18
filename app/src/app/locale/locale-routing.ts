import { isUiLanguage, type UiLanguage } from '@/config/ui-preferences'

function normalizeAppPath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/'
  }

  const trimmed = pathname.startsWith('/') ? pathname : `/${pathname}`
  return trimmed !== '/' && trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

export function getLocaleFromPath(pathname: string): UiLanguage | null {
  const normalizedPath = normalizeAppPath(pathname)
  const firstSegment = normalizedPath.split('/')[1]

  return firstSegment && isUiLanguage(firstSegment) ? firstSegment : null
}

export function stripLocalePrefix(pathname: string): string {
  const normalizedPath = normalizeAppPath(pathname)
  const locale = getLocaleFromPath(normalizedPath)

  if (!locale) {
    return normalizedPath
  }

  const withoutPrefix = normalizedPath.slice(locale.length + 1)

  return withoutPrefix.startsWith('/') ? withoutPrefix : '/'
}

export function localizePath(pathname: string, locale: UiLanguage | null): string {
  const normalizedPath = stripLocalePrefix(pathname)

  if (!locale) {
    return normalizedPath
  }

  return normalizedPath === '/' ? `/${locale}` : `/${locale}${normalizedPath}`
}
