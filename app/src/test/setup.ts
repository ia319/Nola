import '@testing-library/jest-dom/vitest'

const isTestRuntime =
  import.meta.env.MODE === 'test' || Boolean((import.meta.env as Record<string, unknown>).VITEST)

type EnvCarrier = { process?: { env?: Record<string, string | undefined> } }

const runtimeEnv = (globalThis as EnvCarrier).process?.env
const testLogOptIn = runtimeEnv?.NOLA_TEST_LOG === '1'

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
