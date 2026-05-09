export interface LiveWorkbenchTranscriptCounts {
  finalCount: number
  committedPartialCount: number
  previewCount: number
}

export const EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS: LiveWorkbenchTranscriptCounts = {
  finalCount: 0,
  committedPartialCount: 0,
  previewCount: 0,
}

export function selectLiveWorkbenchHasTranscript(counts: LiveWorkbenchTranscriptCounts): boolean {
  return counts.finalCount > 0 || counts.committedPartialCount > 0 || counts.previewCount > 0
}
