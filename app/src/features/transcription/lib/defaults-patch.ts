import type { TranscriptionDefaults } from '@/shared/types'
import type { TranscriptionDefaultsUpdateRequest } from '@/shared/types/config'
import type {
  AdvancedTranscriptionOptions,
  TranscriptionTaskType,
} from '@/features/transcription/types'
import { setValueByPath } from '@/features/transcription/lib/object-path'

type JsonObject = Record<string, unknown>

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i += 1) {
      if (!deepEqual(left[i], right[i])) return false
    }
    return true
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) return false

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false
      if (!deepEqual(left[key], right[key])) return false
    }

    return true
  }

  return false
}

function diffFromBase(base: unknown, target: unknown): unknown | undefined {
  if (isPlainObject(base) && isPlainObject(target)) {
    const diff: JsonObject = {}
    const keys = new Set([...Object.keys(base), ...Object.keys(target)])

    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) continue
      const nextDiff = diffFromBase(base[key], target[key])
      if (nextDiff !== undefined) {
        diff[key] = nextDiff
      }
    }

    return Object.keys(diff).length > 0 ? diff : undefined
  }

  return deepEqual(base, target) ? undefined : target
}

function buildRemovalPatch(previousDiff: unknown, nextDiff: unknown): unknown | undefined {
  if (isPlainObject(previousDiff)) {
    const nextObject = isPlainObject(nextDiff) ? nextDiff : null
    const patch: JsonObject = {}

    for (const key of Object.keys(previousDiff)) {
      if (!nextObject || !Object.prototype.hasOwnProperty.call(nextObject, key)) {
        patch[key] = null
        continue
      }

      const nestedPatch = buildRemovalPatch(previousDiff[key], nextObject[key])
      if (nestedPatch !== undefined) {
        patch[key] = nestedPatch
      }
    }

    return Object.keys(patch).length > 0 ? patch : undefined
  }

  return nextDiff === undefined ? null : undefined
}

function mergePatchObjects(base: JsonObject, overlay: JsonObject): JsonObject {
  const merged: JsonObject = { ...base }

  for (const [key, overlayValue] of Object.entries(overlay)) {
    const baseValue = merged[key]
    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      merged[key] = mergePatchObjects(baseValue, overlayValue)
      continue
    }
    merged[key] = overlayValue
  }

  return merged
}

interface BuildEffectiveDefaultsInput {
  defaults: TranscriptionDefaults
  language: string | undefined
  task: TranscriptionTaskType
  initialPrompt: string | undefined
  advancedOptions: AdvancedTranscriptionOptions
}

/** Build current effective defaults from backend defaults and local overrides. */
export function buildEffectiveDefaults(input: BuildEffectiveDefaultsInput): TranscriptionDefaults {
  const effective = cloneValue(input.defaults)

  effective.language = input.language ?? null
  effective.task = input.task

  if (input.initialPrompt !== undefined) {
    effective.initial_prompt = input.initialPrompt
  }

  for (const [path, value] of Object.entries(input.advancedOptions)) {
    if (value !== undefined) {
      setValueByPath(effective as JsonObject, path, value)
    }
  }

  return effective
}

interface BuildDefaultsPatchInput {
  engineDefaults: TranscriptionDefaults
  previousEffectiveDefaults: TranscriptionDefaults
  nextEffectiveDefaults: TranscriptionDefaults
}

/** Build PATCH payload against engine defaults and current effective defaults. */
export function buildDefaultsPatchPayload(
  input: BuildDefaultsPatchInput,
): TranscriptionDefaultsUpdateRequest {
  const previousDiff = diffFromBase(input.engineDefaults, input.previousEffectiveDefaults)
  const nextDiff = diffFromBase(input.engineDefaults, input.nextEffectiveDefaults)

  const additions = isPlainObject(nextDiff) ? nextDiff : {}
  const removals = buildRemovalPatch(previousDiff, nextDiff)
  const removalPatch = isPlainObject(removals) ? removals : {}

  const merged = mergePatchObjects(additions, removalPatch)
  return merged as TranscriptionDefaultsUpdateRequest
}
