import { muteLogsInTest } from './test-env'

/**
 * Lightweight logger with [Nola] prefix.
 *
 * - `debug` and `info` are suppressed in production builds.
 * - Tests mute logs by default; set `NOLA_TEST_LOG=1` to opt in.
 */
const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV && !muteLogsInTest) {
      console.debug('[Nola]', ...args)
    }
  },
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV && !muteLogsInTest) {
      console.info('[Nola]', ...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (!muteLogsInTest) {
      console.warn('[Nola]', ...args)
    }
  },
  error: (...args: unknown[]) => {
    if (!muteLogsInTest) {
      console.error('[Nola]', ...args)
    }
  },
}

export default logger
