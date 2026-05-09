const EMPTY_DISPLAY_VALUE = '-'

export function formatLiveWorkbenchEmptyValue(): string {
  return EMPTY_DISPLAY_VALUE
}

export function formatLiveWorkbenchCount(count: number): string {
  return String(Math.max(0, count))
}
