import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/shared/lib/query-keys'

describe('queryKeys', () => {
  it('builds stable task list keys with normalized filters', () => {
    expect(
      queryKeys.tasks.list({
        status: 'processing',
        q: 'meeting',
        limit: 25,
      }),
    ).toEqual([
      'tasks',
      'list',
      {
        status: 'processing',
        q: 'meeting',
        sort_by: null,
        order: null,
        limit: 25,
        offset: null,
      },
    ])
  })

  it('normalizes omitted file pagination values', () => {
    expect(queryKeys.files.list()).toEqual([
      'files',
      'list',
      {
        q: '',
        content_type: null,
        sort_by: null,
        order: null,
        limit: null,
        offset: null,
      },
    ])
  })

  it('builds stable file list keys with normalized query controls', () => {
    expect(
      queryKeys.files.list({
        q: 'meeting',
        content_type: 'audio/wav',
        sort_by: 'filename',
        order: 'asc',
        limit: 20,
      }),
    ).toEqual([
      'files',
      'list',
      {
        q: 'meeting',
        content_type: 'audio/wav',
        sort_by: 'filename',
        order: 'asc',
        limit: 20,
        offset: null,
      },
    ])
  })

  it('keeps namespace-specific config keys distinct', () => {
    expect(queryKeys.config.app()).toEqual(['config', 'app'])
    expect(queryKeys.config.transcriptionEngineDefaults()).toEqual([
      'config',
      'transcription',
      'engine-defaults',
    ])
    expect(queryKeys.config.sessionDefaults()).toEqual(['config', 'session-defaults'])
    expect(queryKeys.config.exportDefaults()).toEqual(['config', 'export', 'defaults'])
  })
})
