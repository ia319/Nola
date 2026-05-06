import { afterEach, describe, expect, it } from 'vitest'

import { LIVE_REALTIME_FINAL_TRANSCRIPT_LIMIT, useLiveRealtimeStore } from '../live-realtime-store'
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

  it('keeps only the newest final transcripts in memory', () => {
    const store = useLiveRealtimeStore.getState()

    for (let sequence = 1; sequence <= LIVE_REALTIME_FINAL_TRANSCRIPT_LIMIT + 1; sequence += 1) {
      store.appendLiveRealtimeFinal(finalTranscript('track-1', sequence))
    }

    const state = useLiveRealtimeStore.getState()
    expect(state.finalTranscripts).toHaveLength(LIVE_REALTIME_FINAL_TRANSCRIPT_LIMIT)
    expect(state.finalTranscripts[0]?.sequence).toBe(2)
    expect(state.finalTranscripts.at(-1)?.sequence).toBe(LIVE_REALTIME_FINAL_TRANSCRIPT_LIMIT + 1)
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

function finalTranscript(trackId: string, sequence = 1): LiveRealtimeTranscriptFinalPayload {
  return {
    segment_id: `segment-${sequence}`,
    session_id: 'session-1',
    track_id: trackId,
    source: 'microphone',
    sequence,
    start_ms: 0,
    end_ms: 1000,
    text: 'final text',
    language: null,
    confidence: null,
    is_final: true,
    created_at: '2026-05-06T00:00:00Z',
  }
}
