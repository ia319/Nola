import type { LiveUnsubscribe } from '../types'
import { LiveRealtimeTransportError } from './errors'
import type {
  LiveRealtimeAudioFrame,
  LiveRealtimeClientControlEventInput,
  LiveRealtimeConnectOptions,
  LiveRealtimeConnectionState,
  LiveRealtimeDiagnosticsWavStartOptions,
  LiveRealtimeServerEventCallback,
  LiveRealtimeServerReadyEvent,
  LiveRealtimeTrackStartOptions,
  LiveRealtimeTrackStopOptions,
  LiveRealtimeTransport,
  LiveRealtimeTransportStateCallback,
} from './types'

export class TauriRealtimeTransport implements LiveRealtimeTransport {
  readonly state: LiveRealtimeConnectionState = 'failed'

  connect(
    _sessionId: string,
    _options?: LiveRealtimeConnectOptions,
  ): Promise<LiveRealtimeServerReadyEvent> {
    return Promise.reject(createNotImplementedError())
  }

  disconnect(_code?: number, _reason?: string): void {
    return
  }

  close(_code?: number, _reason?: string): void {
    return
  }

  sendControlEvent(_event: LiveRealtimeClientControlEventInput): void {
    throw createNotImplementedError()
  }

  startTrack(_options: LiveRealtimeTrackStartOptions): void {
    throw createNotImplementedError()
  }

  sendAudioFrame(_frame: LiveRealtimeAudioFrame): void {
    throw createNotImplementedError()
  }

  stopTrack(_trackId: string, _options?: LiveRealtimeTrackStopOptions): void {
    throw createNotImplementedError()
  }

  startDiagnosticsWav(_options?: LiveRealtimeDiagnosticsWavStartOptions): void {
    throw createNotImplementedError()
  }

  stopDiagnosticsWav(): void {
    throw createNotImplementedError()
  }

  ping(): void {
    throw createNotImplementedError()
  }

  finish(): void {
    throw createNotImplementedError()
  }

  onEvent(_callback: LiveRealtimeServerEventCallback): LiveUnsubscribe {
    return noopUnsubscribe
  }

  onStateChange(_callback: LiveRealtimeTransportStateCallback): LiveUnsubscribe {
    return noopUnsubscribe
  }
}

export function createTauriRealtimeTransport(): LiveRealtimeTransport {
  return new TauriRealtimeTransport()
}

function createNotImplementedError(): LiveRealtimeTransportError {
  return new LiveRealtimeTransportError({
    code: 'tauri_realtime_transport_not_implemented',
    message: 'Tauri realtime transport is not implemented',
    retryable: false,
  })
}

function noopUnsubscribe(): void {}
