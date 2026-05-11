import { describe, expect, it } from 'vitest'

import {
  isSameLiveWorkbenchSearch,
  normalizeLiveWorkbenchSearch,
  resolveLiveWorkbenchView,
} from '../live-workbench-search'

describe('live-workbench-search', () => {
  it('keeps only the transcript focus view in the URL search model', () => {
    expect(normalizeLiveWorkbenchSearch({ view: 'transcript-focus' })).toEqual({
      view: 'transcript-focus',
    })
    expect(normalizeLiveWorkbenchSearch({ view: 'default' })).toEqual({})
    expect(normalizeLiveWorkbenchSearch({ view: 'compact' })).toEqual({})
    expect(normalizeLiveWorkbenchSearch(['transcript-focus'])).toEqual({})
  })

  it('resolves the default view when search omits the view value', () => {
    expect(resolveLiveWorkbenchView({})).toBe('default')
    expect(resolveLiveWorkbenchView({ view: 'transcript-focus' })).toBe('transcript-focus')
  })

  it('compares the normalized view value', () => {
    expect(isSameLiveWorkbenchSearch({}, {})).toBe(true)
    expect(isSameLiveWorkbenchSearch({ view: 'transcript-focus' }, {})).toBe(false)
  })
})
