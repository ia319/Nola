import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createLiveSession, finishLiveSession, getLiveSession } from '../api'
import type { LiveSessionDetail } from '@/shared/types'

const apiClientMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/lib/api-client', () => ({
  default: {
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
