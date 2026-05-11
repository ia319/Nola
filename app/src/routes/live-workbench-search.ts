export const LIVE_WORKBENCH_DEFAULT_VIEW = 'default'
export const LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW = 'transcript-focus'

export type LiveWorkbenchView =
  | typeof LIVE_WORKBENCH_DEFAULT_VIEW
  | typeof LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW

export interface LiveWorkbenchRouteSearch {
  view?: typeof LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW
}

function isSearchRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Normalize Live route search params and keep default view omitted from URLs. */
export function normalizeLiveWorkbenchSearch(search: unknown): LiveWorkbenchRouteSearch {
  const searchRecord = isSearchRecord(search) ? search : {}

  return searchRecord.view === LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW
    ? { view: LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW }
    : {}
}

/** Resolve the user-visible Live page layout from normalized search params. */
export function resolveLiveWorkbenchView(search: LiveWorkbenchRouteSearch): LiveWorkbenchView {
  return search.view ?? LIVE_WORKBENCH_DEFAULT_VIEW
}

/** Check whether two normalized Live search models are equivalent. */
export function isSameLiveWorkbenchSearch(
  a: LiveWorkbenchRouteSearch,
  b: LiveWorkbenchRouteSearch,
): boolean {
  return a.view === b.view
}
