import { getValueByPath, setValueByPath } from '@/shared/lib/object-path'
import type {
  CreateLiveSessionRequest,
  LiveRealtimeDefaults,
  LiveRealtimeDefaultsUpdateRequest,
  LiveRealtimeOptionField,
} from '@/shared/types'

export type LiveRealtimeDraftValue = string | number | boolean | number[] | null
export type LiveRealtimeDraft = Record<string, LiveRealtimeDraftValue>
export type LiveRealtimeAdapter = LiveRealtimeOptionField['supported_adapters'][number]
export type LiveRealtimeRuntimeOverrides = NonNullable<
  CreateLiveSessionRequest['runtime_overrides']
>

export const DEFAULT_LIVE_REALTIME_ADAPTER: LiveRealtimeAdapter = 'whisper_streaming'

function isNumberList(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

export function isLiveRealtimeDraftValue(value: unknown): value is LiveRealtimeDraftValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    isNumberList(value)
  )
}

export function areLiveRealtimeDraftValuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }

    return left.every((item, index) => Object.is(item, right[index]))
  }

  return Object.is(left, right)
}

export function resolveLiveRealtimeDefaultValue(
  defaults: LiveRealtimeDefaults,
  key: string,
): unknown {
  return getValueByPath(defaults, key)
}

export function resolveLiveRealtimeEffectiveValue(
  defaults: LiveRealtimeDefaults,
  draft: LiveRealtimeDraft,
  key: string,
): LiveRealtimeDraftValue | undefined {
  if (Object.prototype.hasOwnProperty.call(draft, key)) {
    return draft[key]
  }

  const value = resolveLiveRealtimeDefaultValue(defaults, key)
  return isLiveRealtimeDraftValue(value) ? value : undefined
}

export function updateLiveRealtimeDraft(
  current: LiveRealtimeDraft,
  defaults: LiveRealtimeDefaults,
  key: string,
  value: LiveRealtimeDraftValue,
): LiveRealtimeDraft {
  const next = { ...current }
  const defaultValue = resolveLiveRealtimeDefaultValue(defaults, key)

  if (areLiveRealtimeDraftValuesEqual(value, defaultValue)) {
    delete next[key]
  } else {
    next[key] = value
  }

  return next
}

function buildLiveRealtimePayload(draft: LiveRealtimeDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(draft)) {
    setValueByPath(payload, key, value)
  }

  return payload
}

export function buildLiveRealtimeDefaultsPatchPayload(
  draft: LiveRealtimeDraft,
): LiveRealtimeDefaultsUpdateRequest {
  return buildLiveRealtimePayload(draft) as LiveRealtimeDefaultsUpdateRequest
}

export function buildLiveRealtimeRuntimeOverrides(
  draft: LiveRealtimeDraft,
): LiveRealtimeRuntimeOverrides {
  return buildLiveRealtimePayload(draft) as LiveRealtimeRuntimeOverrides
}
