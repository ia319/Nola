import { create } from 'zustand'

import type { LiveCaptureErrorCode } from '../capture/types'
import type {
  LiveRealtimeConnectionState,
  LiveRealtimeDiagnosticsWavStartedEvent,
  LiveRealtimeDiagnosticsWavStoppedEvent,
  LiveRealtimeTransportErrorCode,
  LiveRealtimeTransportErrorShape,
  LiveRealtimeTransportStateChange,
  LiveRealtimeTranscriptCommittedPartialPayload,
  LiveRealtimeTranscriptFinalPayload,
} from '../transport/types'
import type { LiveAudioSourceKind } from '../capture/types'
import type { LiveSessionDetail, LiveTrack } from '@/shared/types'

export const LIVE_REALTIME_FINAL_TRANSCRIPT_LIMIT = 1000

export type LiveRealtimeRunState =
  | 'idle'
  | 'starting'
  | 'active'
  | 'finishing'
  | 'finished'
  | 'failed'

export type LiveRealtimeRuntimeErrorCode =
  | LiveRealtimeTransportErrorCode
  | LiveCaptureErrorCode
  | 'live_session_create_failed'
  | 'live_session_start_failed'
  | 'live_session_state_invalid'
  | 'live_session_stop_failed'
  | 'live_source_required'
  | 'live_track_ready_timeout'
  | 'live_session_finish_timeout'

export interface LiveRealtimeRuntimeError {
  code: LiveRealtimeRuntimeErrorCode
  message: string
  retryable: boolean
}

export interface LiveRealtimeDiagnosticsWavState {
  active: boolean
  lastStarted: LiveRealtimeDiagnosticsWavStartedEvent | null
  lastStopped: LiveRealtimeDiagnosticsWavStoppedEvent | null
}

export interface LiveRealtimeRuntimeState {
  runState: LiveRealtimeRunState
  session: LiveSessionDetail | null
  connectionState: LiveRealtimeConnectionState
  tracksBySource: Partial<Record<LiveAudioSourceKind, LiveTrack>>
  latestCommittedPartialsByTrackId: Record<string, LiveRealtimeTranscriptCommittedPartialPayload>
  finalTranscripts: LiveRealtimeTranscriptFinalPayload[]
  diagnosticsWav: LiveRealtimeDiagnosticsWavState
  lastError: LiveRealtimeRuntimeError | null
  setLiveRealtimeStarting: () => void
  setLiveRealtimeSession: (session: LiveSessionDetail) => void
  setLiveRealtimeActive: () => void
  setLiveRealtimeFinishing: () => void
  setLiveRealtimeFinished: (session: LiveSessionDetail | null) => void
  setLiveRealtimeFailure: (error: LiveRealtimeRuntimeError) => void
  setLiveRealtimeConnectionState: (change: LiveRealtimeTransportStateChange) => void
  setLiveRealtimeTrack: (track: LiveTrack) => void
  removeLiveRealtimeTrack: (source: LiveAudioSourceKind) => void
  setLiveRealtimeCommittedPartial: (
    committedPartial: LiveRealtimeTranscriptCommittedPartialPayload,
  ) => void
  appendLiveRealtimeFinal: (final: LiveRealtimeTranscriptFinalPayload) => void
  setLiveRealtimeDiagnosticsStarted: (event: LiveRealtimeDiagnosticsWavStartedEvent) => void
  setLiveRealtimeDiagnosticsStopped: (event: LiveRealtimeDiagnosticsWavStoppedEvent) => void
  resetLiveRealtimeRuntimeState: () => void
}

function createDiagnosticsWavState(): LiveRealtimeDiagnosticsWavState {
  return {
    active: false,
    lastStarted: null,
    lastStopped: null,
  }
}

function getInitialLiveRealtimeRuntimeState(): Pick<
  LiveRealtimeRuntimeState,
  | 'runState'
  | 'session'
  | 'connectionState'
  | 'tracksBySource'
  | 'latestCommittedPartialsByTrackId'
  | 'finalTranscripts'
  | 'diagnosticsWav'
  | 'lastError'
> {
  return {
    runState: 'idle',
    session: null,
    connectionState: 'idle',
    tracksBySource: {},
    latestCommittedPartialsByTrackId: {},
    finalTranscripts: [],
    diagnosticsWav: createDiagnosticsWavState(),
    lastError: null,
  }
}

function toRuntimeError(error: LiveRealtimeTransportErrorShape): LiveRealtimeRuntimeError {
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
  }
}

export const useLiveRealtimeStore = create<LiveRealtimeRuntimeState>((set) => ({
  ...getInitialLiveRealtimeRuntimeState(),

  setLiveRealtimeStarting: () =>
    set({
      ...getInitialLiveRealtimeRuntimeState(),
      runState: 'starting',
      connectionState: 'connecting',
    }),

  setLiveRealtimeSession: (session) =>
    set({
      session,
    }),

  setLiveRealtimeActive: () =>
    set({
      runState: 'active',
    }),

  setLiveRealtimeFinishing: () =>
    set({
      runState: 'finishing',
    }),

  setLiveRealtimeFinished: (session) =>
    set((state) => ({
      runState: 'finished',
      session: session ?? state.session,
      connectionState: 'closed',
      tracksBySource: {},
    })),

  setLiveRealtimeFailure: (error) =>
    set({
      runState: 'failed',
      lastError: error,
    }),

  setLiveRealtimeConnectionState: (change) =>
    set((state) => ({
      connectionState: change.state,
      lastError: change.error ? toRuntimeError(change.error) : state.lastError,
    })),

  setLiveRealtimeTrack: (track) =>
    set((state) => ({
      tracksBySource: {
        ...state.tracksBySource,
        [track.source]: track,
      },
    })),

  removeLiveRealtimeTrack: (source) =>
    set((state) => {
      const tracksBySource = {
        ...state.tracksBySource,
      }
      delete tracksBySource[source]

      return {
        tracksBySource,
      }
    }),

  setLiveRealtimeCommittedPartial: (committedPartial) =>
    set((state) => ({
      latestCommittedPartialsByTrackId: {
        ...state.latestCommittedPartialsByTrackId,
        [committedPartial.track_id]: committedPartial,
      },
    })),

  appendLiveRealtimeFinal: (final) =>
    set((state) => {
      const latestCommittedPartialsByTrackId = {
        ...state.latestCommittedPartialsByTrackId,
      }
      delete latestCommittedPartialsByTrackId[final.track_id]

      const finalTranscripts = [...state.finalTranscripts, final].slice(
        -LIVE_REALTIME_FINAL_TRANSCRIPT_LIMIT,
      )

      return {
        latestCommittedPartialsByTrackId,
        finalTranscripts,
      }
    }),

  setLiveRealtimeDiagnosticsStarted: (event) =>
    set((state) => ({
      diagnosticsWav: {
        ...state.diagnosticsWav,
        active: true,
        lastStarted: event,
      },
    })),

  setLiveRealtimeDiagnosticsStopped: (event) =>
    set((state) => ({
      diagnosticsWav: {
        ...state.diagnosticsWav,
        active: false,
        lastStopped: event,
      },
    })),

  resetLiveRealtimeRuntimeState: () => set(getInitialLiveRealtimeRuntimeState()),
}))
