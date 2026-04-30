import '@testing-library/jest-dom/vitest'
import { isTestRuntime, testLogOptIn } from '@/config/test-env'

export const originalConsoleWarn = console.warn
export const originalConsoleError = console.error

// Fallback guard: silence warn/error in tests unless explicitly opted in.
if (isTestRuntime && !testLogOptIn) {
  const noop = () => {}
  console.warn = noop as typeof console.warn
  console.error = noop as typeof console.error
}

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => undefined,
  })
}
