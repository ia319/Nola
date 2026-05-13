import { describe, expect, it } from 'vitest'

import {
  buildHistoryFileQuery,
  buildHistoryLiveQuery,
  buildHistoryTaskQuery,
  isSameHistorySearch,
  normalizeHistorySearch,
} from '../history-search'

describe('history-search', () => {
  it('normalizes mode and shared pagination values', () => {
    expect(
      normalizeHistorySearch({
        mode: 'files',
        content_type: 'audio/wav',
        order: 'asc',
        page: '2',
        page_size: '50',
        q: '  briefing  ',
        sort_by: 'filename',
        status: 'processing',
      }),
    ).toEqual({
      mode: 'files',
      content_type: 'audio/wav',
      order: 'asc',
      page: 2,
      page_size: 50,
      q: 'briefing',
      sort_by: 'filename',
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
      content_type: 'audio/wav',
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
      content_type: 'audio/wav',
      order: 'asc',
      page: 3,
      page_size: 100,
      q: 'delta',
      sort_by: 'filename',
    })
  })

  it('normalizes live mode without task or file filters', () => {
    const search = normalizeHistorySearch({
      mode: 'live',
      content_type: 'audio/wav',
      order: 'asc',
      page: '2',
      page_size: '50',
      q: '  session  ',
      sort_by: 'title',
      status: 'finished',
    })

    expect(search).toEqual({
      mode: 'live',
      order: 'asc',
      page: 2,
      page_size: 50,
      q: 'session',
      sort_by: 'title',
      status: 'finished',
    })
    expect(buildHistoryLiveQuery(search)).toEqual({
      order: 'asc',
      page: 2,
      page_size: 50,
      q: 'session',
      sort_by: 'title',
      status: 'finished',
    })
  })

  it('drops invalid live filters and falls back to live defaults', () => {
    expect(
      normalizeHistorySearch({
        mode: 'live',
        content_type: 'audio/wav',
        order: 'sideways',
        q: 'session',
        sort_by: 'filename',
        status: 'processing',
      }),
    ).toEqual({
      mode: 'live',
      q: 'session',
    })
  })

  it('ignores live-only status values when building task queries', () => {
    expect(
      buildHistoryTaskQuery({
        q: 'session',
        status: 'active',
      }),
    ).toEqual({
      order: 'desc',
      page: 1,
      page_size: 20,
      q: 'session',
      sort_by: 'created_at',
      status: 'all',
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
