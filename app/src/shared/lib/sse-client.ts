import { getApiBaseUrl } from '@/config/backend'

export interface SSEvent<T = unknown> {
  event: string
  data: T
}

export interface SSEOptions<T = unknown> {
  onMessage: (event: SSEvent<T>) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  /** Defaults to `['message']` when omitted. */
  eventNames?: string[]
}

function buildSSEUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

/**
 * Open an SSE connection and return a cleanup function.
 * Auto-reconnect relies on browser-native EventSource behaviour.
 */
export function createSSEConnection<T = unknown>(path: string, options: SSEOptions<T>): () => void {
  const url = buildSSEUrl(getApiBaseUrl(), path)
  const source = new EventSource(url)

  const eventNames = options.eventNames ?? ['message']

  const handler = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as T
      options.onMessage({ event: e.type, data })
    } catch {
      // Silently ignore non-JSON payloads.
    }
  }

  for (const name of eventNames) {
    source.addEventListener(name, handler)
  }

  if (options.onOpen) {
    source.addEventListener('open', options.onOpen)
  }

  if (options.onError) {
    source.addEventListener('error', options.onError)
  }

  return () => {
    source.close()
  }
}
