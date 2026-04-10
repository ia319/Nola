type EnvCarrier = { process?: { env?: Record<string, string | undefined> } }
type TestImportMetaEnv = ImportMetaEnv & { VITEST?: boolean }

const runtimeEnv = (globalThis as EnvCarrier).process?.env
const viteEnv = import.meta.env as TestImportMetaEnv

export const isTestRuntime = viteEnv.MODE === 'test' || Boolean(viteEnv.VITEST)

export const testLogOptIn = runtimeEnv?.NOLA_TEST_LOG === '1'

export const muteLogsInTest = isTestRuntime && !testLogOptIn
