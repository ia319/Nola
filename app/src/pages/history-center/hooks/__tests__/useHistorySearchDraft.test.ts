// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useHistorySearchDraft } from '../useHistorySearchDraft'

describe('useHistorySearchDraft', () => {
  it('resets stale drafts when the committed value cycles back', () => {
    const { result, rerender } = renderHook(
      ({ committedValue }) => useHistorySearchDraft(committedValue),
      {
        initialProps: { committedValue: 'alpha' },
      },
    )

    act(() => {
      result.current[1]('alpha draft')
    })
    expect(result.current[0]).toBe('alpha draft')

    rerender({ committedValue: 'beta' })
    expect(result.current[0]).toBe('beta')

    rerender({ committedValue: 'alpha' })
    expect(result.current[0]).toBe('alpha')
  })
})
