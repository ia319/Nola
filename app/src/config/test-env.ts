type EnvCarrier = { process?: { env?: Record<string, string | undefined> } }

const runtimeEnv = (globalThis as EnvCarrier).process?.env

export const isTestRuntime =
  import.meta.env.MODE === 'test' || Boolean((import.meta.env as Record<string, unknown>).VITEST)

export const testLogOptIn = runtimeEnv?.NOLA_TEST_LOG === '1'

export const muteLogsInTest = isTestRuntime && !testLogOptIn
