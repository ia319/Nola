import type { EngineComputeType, EngineDevice } from '@/shared/types'

export const DEFAULT_ENGINE_DEVICE: EngineDevice = 'auto'
export const DEFAULT_ENGINE_COMPUTE_TYPE: EngineComputeType = 'default'

export const ENGINE_DEVICE_OPTIONS = [
  'auto',
  'cpu',
  'cuda',
] as const satisfies readonly EngineDevice[]

export const ENGINE_COMPUTE_TYPE_OPTIONS = [
  'default',
  'float16',
  'int8',
] as const satisfies readonly EngineComputeType[]

const ENGINE_DEVICE_OPTION_SET: ReadonlySet<string> = new Set(ENGINE_DEVICE_OPTIONS)
const ENGINE_COMPUTE_TYPE_OPTION_SET: ReadonlySet<string> = new Set(ENGINE_COMPUTE_TYPE_OPTIONS)

export function isEngineDevice(value: string): value is EngineDevice {
  return ENGINE_DEVICE_OPTION_SET.has(value)
}

export function isEngineComputeType(value: string): value is EngineComputeType {
  return ENGINE_COMPUTE_TYPE_OPTION_SET.has(value)
}
