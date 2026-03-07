/**
 * Lightweight logger with [Nola] prefix.
 *
 * - `debug` is suppressed in production builds.
 * - To integrate Sentry later, add a call inside `error()`.
 */
const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.debug('[Nola]', ...args)
    }
  },
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.info('[Nola]', ...args)
    }
  },
  warn: (...args: unknown[]) => {
    console.warn('[Nola]', ...args)
  },
  error: (...args: unknown[]) => {
    console.error('[Nola]', ...args)
  },
}

export default logger
