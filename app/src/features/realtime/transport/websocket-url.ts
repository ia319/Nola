import { getActiveWebSocketBaseUrl } from '@/config/connection/runtime'

export function buildLiveRealtimeWebSocketUrl(sessionId: string, baseUrl?: string): string {
  const path = `/api/live/sessions/${encodeURIComponent(sessionId)}/stream`
  const configuredBaseUrl = baseUrl ?? getActiveWebSocketBaseUrl()

  if (!configuredBaseUrl) {
    const location = getBrowserLocation()
    if (!location) {
      return path
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${location.host}${path}`
  }

  const resolvedUrl = resolveUrl(configuredBaseUrl, path)
  if (resolvedUrl.protocol === 'http:') {
    resolvedUrl.protocol = 'ws:'
  } else if (resolvedUrl.protocol === 'https:') {
    resolvedUrl.protocol = 'wss:'
  }

  return resolvedUrl.toString()
}

function resolveUrl(baseUrl: string, path: string): URL {
  const location = getBrowserLocation()

  if (location && baseUrl.startsWith('/')) {
    return new URL(path, `${location.origin}${baseUrl}`)
  }

  return new URL(path, ensureUrlBase(baseUrl))
}

function ensureUrlBase(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function getBrowserLocation(): Location | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.location
}
