import { describe, expect, it } from 'vitest'

import {
  EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS,
  selectLiveWorkbenchHasTranscript,
} from '../live-workbench-selectors'

describe('live workbench selectors', () => {
  it('treats an empty transcript count set as empty', () => {
    expect(selectLiveWorkbenchHasTranscript(EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS)).toBe(false)
  })

  it('detects visible transcript stream items', () => {
    expect(
      selectLiveWorkbenchHasTranscript({
        finalCount: 0,
        committedPartialCount: 1,
        previewCount: 0,
      }),
    ).toBe(true)
  })
})
