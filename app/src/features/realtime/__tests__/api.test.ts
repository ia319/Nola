import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  batchDeleteLiveSessionRecords,
  batchExportLiveSessions,
  createLiveSession,
  deleteLiveSessionRecord,
  downloadLiveSessionExport,
  finishLiveSession,
  getLiveSession,
  listLiveSessions,
  saveLiveSessionExport,
} from '../api'
import type { LiveSessionDetail } from '@/shared/types'

const apiClientMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/lib/api-client', () => ({
  default: {
    delete: apiClientMocks.delete,
    get: apiClientMocks.get,
    post: apiClientMocks.post,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('realtime api', () => {
  it('creates a live session with streaming metadata', async () => {
    const signal = new AbortController().signal
    apiClientMocks.post.mockResolvedValueOnce({ data: liveSession('session-1') })

    const response = await createLiveSession(
      {
        mode: 'streaming',
        title: 'Live test',
        language_hint: null,
        runtime_overrides: {
          language: 'en',
          min_chunk_ms: 700,
          vad_parameters: {
            threshold: 0.6,
          },
        },
      },
      signal,
    )

    expect(apiClientMocks.post).toHaveBeenCalledWith(
      '/api/live/sessions',
      {
        mode: 'streaming',
        title: 'Live test',
        language_hint: null,
        runtime_overrides: {
          language: 'en',
          min_chunk_ms: 700,
          vad_parameters: {
            threshold: 0.6,
          },
        },
      },
      { signal },
    )
    expect(response.session_id).toBe('session-1')
  })

  it('reads and finishes live sessions with segment window params', async () => {
    const signal = new AbortController().signal
    apiClientMocks.get.mockResolvedValueOnce({ data: liveSession('session-1') })
    apiClientMocks.post.mockResolvedValueOnce({ data: liveSession('session-1') })

    await getLiveSession('session-1', { segmentLimit: 10, segmentOffset: 20 }, signal)
    await finishLiveSession('session-1', { segmentLimit: 5 })

    expect(apiClientMocks.get).toHaveBeenCalledWith('/api/live/sessions/session-1', {
      params: {
        segment_limit: 10,
        segment_offset: 20,
      },
      signal,
    })
    expect(apiClientMocks.post).toHaveBeenCalledWith(
      '/api/live/sessions/session-1/finish',
      undefined,
      {
        params: {
          segment_limit: 5,
        },
      },
    )
  })

  it('lists live sessions with history query params', async () => {
    const signal = new AbortController().signal
    apiClientMocks.get.mockResolvedValueOnce({
      data: {
        limit: 20,
        offset: 0,
        sessions: [liveSession('session-1')],
        total: 1,
      },
    })

    const response = await listLiveSessions(
      {
        limit: 20,
        offset: 0,
        order: 'asc',
        q: 'session',
        sort_by: 'title',
        status: 'finished',
      },
      signal,
    )

    expect(apiClientMocks.get).toHaveBeenCalledWith('/api/live/sessions', {
      params: {
        limit: 20,
        offset: 0,
        order: 'asc',
        q: 'session',
        sort_by: 'title',
        status: 'finished',
      },
      signal,
    })
    expect(response.total).toBe(1)
  })

  it('exports live sessions and parses download filenames', async () => {
    const signal = new AbortController().signal
    const blob = new Blob(['srt'])
    apiClientMocks.get.mockResolvedValueOnce({
      data: blob,
      headers: {
        'content-disposition': "attachment; filename*=UTF-8''meeting.srt",
      },
    })
    apiClientMocks.get.mockResolvedValueOnce({ data: { saved_path: 'exports/meeting.srt' } })
    apiClientMocks.post.mockResolvedValueOnce({
      data: blob,
      headers: {
        'content-disposition': 'attachment; filename="live.zip"',
      },
    })

    const download = await downloadLiveSessionExport(
      'session-1',
      {
        filename: 'meeting',
        format: 'srt',
        include_timestamps: true,
      },
      signal,
    )
    const saved = await saveLiveSessionExport('session-1', { format: 'txt' })
    const batch = await batchExportLiveSessions({
      format: 'srt',
      include_timestamps: true,
      session_ids: ['session-1'],
      zip_name: 'live',
    })

    expect(apiClientMocks.get).toHaveBeenNthCalledWith(1, '/api/live/sessions/session-1/export', {
      params: {
        filename: 'meeting',
        format: 'srt',
        include_timestamps: true,
        save: false,
      },
      responseType: 'blob',
      signal,
    })
    expect(apiClientMocks.get).toHaveBeenNthCalledWith(2, '/api/live/sessions/session-1/export', {
      params: {
        format: 'txt',
        save: true,
      },
      signal: undefined,
    })
    expect(apiClientMocks.post).toHaveBeenCalledWith(
      '/api/live/sessions/export/batch',
      {
        format: 'srt',
        include_timestamps: true,
        session_ids: ['session-1'],
        zip_name: 'live',
      },
      {
        responseType: 'blob',
        signal: undefined,
      },
    )
    expect(download.filename).toBe('meeting.srt')
    expect(saved.saved_path).toBe('exports/meeting.srt')
    expect(batch.filename).toBe('live.zip')
  })

  it('deletes live session records', async () => {
    apiClientMocks.delete.mockResolvedValueOnce({
      data: {
        message: 'Live session record deleted',
        session_id: 'session-1',
      },
    })
    apiClientMocks.post.mockResolvedValueOnce({
      data: {
        action: 'delete_record',
        results: [],
        summary: {
          failed: 0,
          requested: 1,
          succeeded: 1,
        },
      },
    })

    await deleteLiveSessionRecord('session-1')
    await batchDeleteLiveSessionRecords({ session_ids: ['session-1'] })

    expect(apiClientMocks.delete).toHaveBeenCalledWith('/api/live/sessions/session-1/record')
    expect(apiClientMocks.post).toHaveBeenCalledWith('/api/live/sessions/batch/delete-records', {
      session_ids: ['session-1'],
    })
  })
})

function liveSession(sessionId: string): LiveSessionDetail {
  return {
    session_id: sessionId,
    title: null,
    mode: 'streaming',
    status: 'active',
    language_hint: null,
    model_id: null,
    runtime: null,
    audio_format: null,
    started_at: '2026-05-06T00:00:00Z',
    ended_at: null,
    error: null,
    created_at: '2026-05-06T00:00:00Z',
    updated_at: '2026-05-06T00:00:00Z',
    tracks: [],
    segments: [],
    segment_total: 0,
    segment_limit: 100,
    segment_offset: 0,
  }
}
