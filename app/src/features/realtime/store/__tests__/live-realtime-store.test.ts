import { afterEach, describe, expect, it } from 'vitest'

import { useLiveRealtimeStore } from '../live-realtime-store'
import type {
  LiveRealtimeTranscriptFinalPayload,
  LiveRealtimeTranscriptPartialPayload,
} from '../../transport/types'
import type { LiveTrack } from '@/shared/types'

afterEach(() => {
  useLiveRealtimeStore.getState().resetLiveRealtimeRuntimeState()
})

describe('live realtime store', () => {
  it('tracks runtime connection and source tracks without UI state', () => {
    const store = useLiveRealtimeStore.getState()

    store.setLiveRealtimeStarting()
    store.setLiveRealtimeConnectionState({
      state: 'ready',
      previousState: 'connecting',
      changedAt: 1,
      error: null,
    })
    store.setLiveRealtimeTrack(liveTrack('session-1', 'track-1', 'microphone'))
    store.setLiveRealtimeActive()

    const state = useLiveRealtimeStore.getState()
    expect(state.runState).toBe('active')
    expect(state.connectionState).toBe('ready')
    expect(state.tracksBySource.microphone?.track_id).toBe('track-1')
  })

  it('keeps partial transcripts in memory and clears them after final', () => {
    const store = useLiveRealtimeStore.getState()

    store.setLiveRealtimePartial(partialTranscript('track-1'))
    expect(useLiveRealtimeStore.getState().latestPartialsByTrackId['track-1']?.text).toBe(
      'partial text',
    )

    store.appendLiveRealtimeFinal(finalTranscript('track-1'))

    const state = useLiveRealtimeStore.getState()
    expect(state.latestPartialsByTrackId['track-1']).toBeUndefined()
    expect(state.finalTranscripts).toHaveLength(1)
    expect(state.finalTranscripts[0]?.text).toBe('final text')
  })
})

function liveTrack(sessionId: string, trackId: string, source: LiveTrack['source']): LiveTrack {
  return {
    track_id: trackId,
    session_id: sessionId,
    source,
    label: null,
    device_label: null,
    sample_rate: 16000,
    channel_count: 1,
    started_at: '2026-05-06T00:00:00Z',
    ended_at: null,
    created_at: '2026-05-06T00:00:00Z',
  }
}

function partialTranscript(trackId: string): LiveRealtimeTranscriptPartialPayload {
  return {
    track_id: trackId,
    source: 'microphone',
    partial_index: 1,
    start_ms: 0,
    end_ms: 500,
    text: 'partial text',
    language: null,
    confidence: null,
    is_final: false,
  }
}

function finalTranscript(trackId: string): LiveRealtimeTranscriptFinalPayload {
  return {
    segment_id: 'segment-1',
    session_id: 'session-1',
    track_id: trackId,
    source: 'microphone',
    sequence: 1,
    start_ms: 0,
    end_ms: 1000,
    text: 'final text',
    language: null,
    confidence: null,
    is_final: true,
    created_at: '2026-05-06T00:00:00Z',
  }
}
