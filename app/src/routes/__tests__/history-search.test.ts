import { describe, expect, it } from 'vitest'

import {
  buildHistoryFileQuery,
  buildHistoryTaskQuery,
  isSameHistorySearch,
  normalizeHistorySearch,
} from '../history-search'

describe('history-search', () => {
  it('normalizes mode and shared pagination values', () => {
    expect(
      normalizeHistorySearch({
        mode: 'files',
        order: 'asc',
        page: '2',
        page_size: '50',
        q: '  briefing  ',
        sort_by: 'filename',
        status: 'processing',
      }),
    ).toEqual({
      mode: 'files',
      order: 'asc',
      page: 2,
      page_size: 50,
      q: 'briefing',
      sort_by: 'filename',
      status: 'processing',
    })
  })

  it('builds independent task and file queries from one search model', () => {
    const search = normalizeHistorySearch({
      mode: 'files',
      order: 'asc',
      page: 3,
      page_size: 100,
      q: 'delta',
      sort_by: 'filename',
      status: 'failed',
    })

    expect(buildHistoryTaskQuery(search)).toEqual({
      order: 'asc',
      page: 3,
      page_size: 100,
      q: 'delta',
      sort_by: 'filename',
      status: 'failed',
    })
    expect(buildHistoryFileQuery(search)).toEqual({
      page: 3,
      page_size: 100,
    })
  })

  it('compares mode as part of the normalized search identity', () => {
    expect(
      isSameHistorySearch(
        { mode: 'files', page: 2, page_size: 50 },
        { mode: 'files', page: 2, page_size: 50 },
      ),
    ).toBe(true)
    expect(
      isSameHistorySearch({ mode: 'files', page: 2, page_size: 50 }, { page: 2, page_size: 50 }),
    ).toBe(false)
  })
})
