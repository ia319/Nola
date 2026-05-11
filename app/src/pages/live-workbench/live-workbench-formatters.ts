import { formatMillisecondsClock, formatMillisecondsClockRange } from '@/shared/lib/time-format'

const EMPTY_DISPLAY_VALUE = '-'

export function formatLiveWorkbenchEmptyValue(): string {
  return EMPTY_DISPLAY_VALUE
}

export function formatLiveWorkbenchCount(count: number): string {
  return String(Math.max(0, count))
}

export function formatLiveWorkbenchSessionId(
  sessionId: string | null | undefined,
  emptyValue = EMPTY_DISPLAY_VALUE,
): string {
  if (!sessionId) return emptyValue

  return sessionId.length > 12 ? `${sessionId.slice(0, 8)}...` : sessionId
}

export function formatLiveWorkbenchDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
  nowMs: number,
  emptyValue = EMPTY_DISPLAY_VALUE,
): string {
  if (!startedAt) return emptyValue

  const startMs = Date.parse(startedAt)
  const endMs = endedAt ? Date.parse(endedAt) : nowMs

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return emptyValue
  }

  return formatMillisecondsClock(endMs - startMs)
}

export function formatLiveWorkbenchTranscriptTimeRange(startMs: number, endMs: number): string {
  return formatMillisecondsClockRange(startMs, endMs)
}
