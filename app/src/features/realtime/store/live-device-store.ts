import { create } from 'zustand'

import type {
  LiveDevicePermissionResult,
  LiveDeviceSelectionState,
} from '../devices/audio-device-repository'
import { isTemporaryLiveDeviceId } from '../devices/types'
import type { LiveDeviceInventory } from '../devices/types'
import type {
  LiveAudioLevel,
  LiveAudioSourceKind,
  LiveCaptureErrorCode,
  LiveCaptureState,
  LiveCaptureStateChange,
} from '../capture/types'
import type { LiveTimestampMs } from '../types'

export type LiveDeviceInventoryStatus = 'idle' | 'loading' | 'ready' | 'error'

export type LiveDeviceInventoryErrorCode = 'device_inventory_failed'

export interface LiveCaptureSlotState {
  sessionId: string | null
  sourceKind: LiveAudioSourceKind
  deviceId: string | null
  state: LiveCaptureState
  errorCode: LiveCaptureErrorCode | null
  level: LiveAudioLevel | null
  startedAt: LiveTimestampMs | null
}

export interface LiveCaptureSessionSnapshot {
  sessionId: string
  deviceId: string | null
  startedAt: LiveTimestampMs
}

export interface LiveDeviceStoreState {
  inventory: LiveDeviceInventory | null
  inventoryStatus: LiveDeviceInventoryStatus
  inventoryError: LiveDeviceInventoryErrorCode | null
  lastMicrophonePermission: LiveDevicePermissionResult | null
  selectedMicrophoneId: string | null
  selectedSpeakerId: string | null
  activeMicrophoneId: string | null
  activeSpeakerId: string | null
  microphoneCapture: LiveCaptureSlotState
  systemAudioCapture: LiveCaptureSlotState
  setSelectedMicrophoneId: (deviceId: string | null) => void
  setSelectedSpeakerId: (deviceId: string | null) => void
  setActiveSpeakerId: (deviceId: string | null) => void
  setInventoryLoading: () => void
  setInventoryReady: (inventory: LiveDeviceInventory) => void
  setInventoryError: (errorCode: LiveDeviceInventoryErrorCode) => void
  setLastMicrophonePermission: (result: LiveDevicePermissionResult) => void
  setMicrophoneCaptureStarting: (deviceId: string | null) => void
  setMicrophoneCaptureSession: (snapshot: LiveCaptureSessionSnapshot) => void
  setMicrophoneCaptureState: (change: LiveCaptureStateChange) => void
  setMicrophoneCaptureFailure: (errorCode: LiveCaptureErrorCode) => void
  setMicrophoneLevel: (level: LiveAudioLevel) => void
  clearMicrophoneCapture: () => void
  setSystemAudioCaptureStarting: () => void
  setSystemAudioCaptureSession: (snapshot: LiveCaptureSessionSnapshot) => void
  setSystemAudioCaptureState: (change: LiveCaptureStateChange) => void
  setSystemAudioCaptureFailure: (errorCode: LiveCaptureErrorCode) => void
  setSystemAudioLevel: (level: LiveAudioLevel) => void
  clearSystemAudioCapture: () => void
  resetLiveDeviceState: () => void
}

function normalizeDeviceId(deviceId: string | null): string | null {
  if (!deviceId || isTemporaryLiveDeviceId(deviceId)) {
    return null
  }

  return deviceId
}

function createCaptureSlot(sourceKind: LiveAudioSourceKind): LiveCaptureSlotState {
  return {
    sessionId: null,
    sourceKind,
    deviceId: null,
    state: 'idle',
    errorCode: null,
    level: null,
    startedAt: null,
  }
}

function isActiveCaptureState(state: LiveCaptureState): boolean {
  return state === 'starting' || state === 'capturing' || state === 'paused' || state === 'stopping'
}

const UNSUPPORTED_CAPTURE_ERROR_CODES = new Set<LiveCaptureErrorCode>([
  'microphone_capture_unsupported',
  'system_audio_capture_unsupported',
  'tauri_capture_not_implemented',
])

function getFailureState(errorCode: LiveCaptureErrorCode): LiveCaptureState {
  return UNSUPPORTED_CAPTURE_ERROR_CODES.has(errorCode) ? 'unsupported' : 'failed'
}

function getInitialLiveDeviceState(): Pick<
  LiveDeviceStoreState,
  | 'inventory'
  | 'inventoryStatus'
  | 'inventoryError'
  | 'lastMicrophonePermission'
  | 'selectedMicrophoneId'
  | 'selectedSpeakerId'
  | 'activeMicrophoneId'
  | 'activeSpeakerId'
  | 'microphoneCapture'
  | 'systemAudioCapture'
> {
  return {
    inventory: null,
    inventoryStatus: 'idle',
    inventoryError: null,
    lastMicrophonePermission: null,
    selectedMicrophoneId: null,
    selectedSpeakerId: null,
    activeMicrophoneId: null,
    activeSpeakerId: null,
    microphoneCapture: createCaptureSlot('microphone'),
    systemAudioCapture: createCaptureSlot('system'),
  }
}

export function getLiveDeviceSelectionState(
  state: Pick<
    LiveDeviceStoreState,
    'selectedMicrophoneId' | 'activeMicrophoneId' | 'selectedSpeakerId' | 'activeSpeakerId'
  >,
): LiveDeviceSelectionState {
  return {
    selectedMicrophoneId: state.selectedMicrophoneId,
    activeMicrophoneId: state.activeMicrophoneId,
    selectedSpeakerId: state.selectedSpeakerId,
    activeSpeakerId: state.activeSpeakerId,
  }
}

export const useLiveDeviceStore = create<LiveDeviceStoreState>((set) => ({
  ...getInitialLiveDeviceState(),

  setSelectedMicrophoneId: (deviceId) =>
    set({
      selectedMicrophoneId: normalizeDeviceId(deviceId),
    }),

  setSelectedSpeakerId: (deviceId) =>
    set({
      selectedSpeakerId: normalizeDeviceId(deviceId),
    }),

  setActiveSpeakerId: (deviceId) =>
    set({
      activeSpeakerId: normalizeDeviceId(deviceId),
    }),

  setInventoryLoading: () =>
    set({
      inventoryStatus: 'loading',
      inventoryError: null,
    }),

  setInventoryReady: (inventory) =>
    set({
      inventory,
      inventoryStatus: 'ready',
      inventoryError: null,
    }),

  setInventoryError: (errorCode) =>
    set({
      inventoryStatus: 'error',
      inventoryError: errorCode,
    }),

  setLastMicrophonePermission: (result) =>
    set({
      lastMicrophonePermission: result,
    }),

  setMicrophoneCaptureStarting: (deviceId) =>
    set((state) => ({
      activeMicrophoneId: null,
      microphoneCapture: {
        ...state.microphoneCapture,
        sessionId: null,
        deviceId: normalizeDeviceId(deviceId),
        state: 'starting',
        errorCode: null,
        level: null,
        startedAt: null,
      },
    })),

  setMicrophoneCaptureSession: (snapshot) =>
    set((state) => {
      const deviceId = normalizeDeviceId(snapshot.deviceId)

      return {
        activeMicrophoneId: deviceId,
        microphoneCapture: {
          ...state.microphoneCapture,
          sessionId: snapshot.sessionId,
          deviceId,
          state: 'capturing',
          errorCode: null,
          startedAt: snapshot.startedAt,
        },
      }
    }),

  setMicrophoneCaptureState: (change) =>
    set((state) => {
      const microphoneCapture = {
        ...state.microphoneCapture,
        state: change.state,
        errorCode: change.errorCode,
      }

      return {
        activeMicrophoneId: isActiveCaptureState(change.state) ? microphoneCapture.deviceId : null,
        microphoneCapture,
      }
    }),

  setMicrophoneCaptureFailure: (errorCode) =>
    set((state) => ({
      activeMicrophoneId: null,
      microphoneCapture: {
        ...state.microphoneCapture,
        state: getFailureState(errorCode),
        errorCode,
      },
    })),

  setMicrophoneLevel: (level) =>
    set((state) => ({
      microphoneCapture: {
        ...state.microphoneCapture,
        level,
      },
    })),

  clearMicrophoneCapture: () =>
    set({
      activeMicrophoneId: null,
      microphoneCapture: createCaptureSlot('microphone'),
    }),

  setSystemAudioCaptureStarting: () =>
    set((state) => ({
      systemAudioCapture: {
        ...state.systemAudioCapture,
        sessionId: null,
        deviceId: null,
        state: 'starting',
        errorCode: null,
        level: null,
        startedAt: null,
      },
    })),

  setSystemAudioCaptureSession: (snapshot) =>
    set((state) => ({
      systemAudioCapture: {
        ...state.systemAudioCapture,
        sessionId: snapshot.sessionId,
        deviceId: null,
        state: 'capturing',
        errorCode: null,
        startedAt: snapshot.startedAt,
      },
    })),

  setSystemAudioCaptureState: (change) =>
    set((state) => ({
      systemAudioCapture: {
        ...state.systemAudioCapture,
        state: change.state,
        errorCode: change.errorCode,
      },
    })),

  setSystemAudioCaptureFailure: (errorCode) =>
    set((state) => ({
      systemAudioCapture: {
        ...state.systemAudioCapture,
        state: getFailureState(errorCode),
        errorCode,
      },
    })),

  setSystemAudioLevel: (level) =>
    set((state) => ({
      systemAudioCapture: {
        ...state.systemAudioCapture,
        level,
      },
    })),

  clearSystemAudioCapture: () =>
    set({
      systemAudioCapture: createCaptureSlot('system'),
    }),

  resetLiveDeviceState: () => set(getInitialLiveDeviceState()),
}))
