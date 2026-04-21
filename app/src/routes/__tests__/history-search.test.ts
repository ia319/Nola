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
      page: 2,
      page_size: 50,
    })
  })

  it('ignores non-plain search objects', () => {
    class SearchLike {
      mode = 'files'
      page = '2'
    }

    expect(normalizeHistorySearch(['files', '2'])).toEqual({})
    expect(normalizeHistorySearch(new SearchLike())).toEqual({})
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
      order: 'desc',
      page: 3,
      page_size: 100,
      q: '',
      sort_by: 'created_at',
      status: 'all',
    })
    expect(buildHistoryFileQuery(search)).toEqual({
      page: 3,
      page_size: 100,
    })
  })

  it('compares mode as part of the normalized search identity', () => {
    expect(
      isSameHistorySearch(
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
      ),
    ).toBe(true)
    expect(
      isSameHistorySearch(
        normalizeHistorySearch({ page: 2, page_size: 50 }),
        normalizeHistorySearch({ mode: 'tasks', page: 2, page_size: 50 }),
      ),
    ).toBe(true)
    expect(
      isSameHistorySearch(
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
        {
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
      ),
    ).toBe(false)
    expect(
      isSameHistorySearch(
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
        {
          mode: 'files',
          q: 'beta',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
      ),
    ).toBe(false)
    expect(
      isSameHistorySearch(
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
        {
          mode: 'files',
          q: 'alpha',
          status: 'failed',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
      ),
    ).toBe(false)
    expect(
      isSameHistorySearch(
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'created_at',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
      ),
    ).toBe(false)
    expect(
      isSameHistorySearch(
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'asc',
          page: 2,
          page_size: 50,
        },
        {
          mode: 'files',
          q: 'alpha',
          status: 'processing',
          sort_by: 'filename',
          order: 'desc',
          page: 2,
          page_size: 50,
        },
      ),
    ).toBe(false)
  })
})
