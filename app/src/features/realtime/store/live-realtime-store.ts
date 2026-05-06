import { create } from 'zustand'

import type { LiveCaptureErrorCode } from '../capture/types'
import type {
  LiveRealtimeConnectionState,
  LiveRealtimeDiagnosticsWavStartedEvent,
  LiveRealtimeDiagnosticsWavStoppedEvent,
  LiveRealtimeTransportErrorCode,
  LiveRealtimeTransportErrorShape,
  LiveRealtimeTransportStateChange,
  LiveRealtimeTranscriptFinalPayload,
  LiveRealtimeTranscriptPartialPayload,
} from '../transport/types'
import type { LiveAudioSourceKind } from '../capture/types'
import type { LiveSessionDetail, LiveTrack } from '@/shared/types'

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
  latestPartialsByTrackId: Record<string, LiveRealtimeTranscriptPartialPayload>
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
  setLiveRealtimePartial: (partial: LiveRealtimeTranscriptPartialPayload) => void
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
  | 'latestPartialsByTrackId'
  | 'finalTranscripts'
  | 'diagnosticsWav'
  | 'lastError'
> {
  return {
    runState: 'idle',
    session: null,
    connectionState: 'idle',
    tracksBySource: {},
    latestPartialsByTrackId: {},
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

  setLiveRealtimePartial: (partial) =>
    set((state) => ({
      latestPartialsByTrackId: {
        ...state.latestPartialsByTrackId,
        [partial.track_id]: partial,
      },
    })),

  appendLiveRealtimeFinal: (final) =>
    set((state) => {
      const latestPartialsByTrackId = {
        ...state.latestPartialsByTrackId,
      }
      delete latestPartialsByTrackId[final.track_id]

      return {
        latestPartialsByTrackId,
        finalTranscripts: [...state.finalTranscripts, final],
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
