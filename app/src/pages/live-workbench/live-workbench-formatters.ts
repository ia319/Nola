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

  const totalSeconds = Math.floor((endMs - startMs) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${padTimeUnit(minutes)}:${padTimeUnit(seconds)}`
  }

  return `${minutes}:${padTimeUnit(seconds)}`
}

export function formatLiveWorkbenchTranscriptTimeRange(startMs: number, endMs: number): string {
  return `${formatTranscriptTime(startMs)} - ${formatTranscriptTime(endMs)}`
}

function formatTranscriptTime(valueMs: number): string {
  const totalMs = Math.max(0, Number.isFinite(valueMs) ? valueMs : 0)
  const totalSeconds = Math.floor(totalMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${padTimeUnit(seconds)}`
}

function padTimeUnit(value: number): string {
  return String(value).padStart(2, '0')
}
