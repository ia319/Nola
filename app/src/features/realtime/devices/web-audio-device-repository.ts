import type {
  LiveAudioDeviceRepository,
  LiveDeviceChangeCallback,
  LiveDevicePermissionResult,
  LiveDeviceSelectionState,
} from './audio-device-repository'
import type {
  LiveAudioDevice,
  LiveDeviceCapabilityState,
  LiveDeviceInventory,
  LiveDeviceKind,
  LiveDevicePermissionState,
  LiveDeviceWarningCode,
} from './types'

type SinkSelectableMediaElement = HTMLMediaElement & {
  setSinkId?: (sinkId: string) => Promise<void>
}

type BrowserMediaDevices = Pick<
  MediaDevices,
  'enumerateDevices' | 'getUserMedia' | 'addEventListener' | 'removeEventListener'
> & {
  getDisplayMedia?: MediaDevices['getDisplayMedia']
}

function getBrowserMediaDevices(): BrowserMediaDevices | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  return (navigator.mediaDevices as BrowserMediaDevices | undefined) ?? null
}

function getCurrentState(state: LiveDeviceSelectionState = {}): LiveDeviceInventory['current'] {
  return {
    microphone: {
      selectedDeviceId: state.selectedMicrophoneId ?? null,
      activeDeviceId: state.activeMicrophoneId ?? null,
    },
    speaker: {
      selectedDeviceId: state.selectedSpeakerId ?? null,
      activeDeviceId: state.activeSpeakerId ?? null,
    },
  }
}

function addWarning(warnings: Set<LiveDeviceWarningCode>, warning: LiveDeviceWarningCode): void {
  warnings.add(warning)
}

function isInsecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === false
}

function supportsSpeakerSelection(): boolean {
  if (typeof HTMLMediaElement === 'undefined') {
    return false
  }

  return typeof (HTMLMediaElement.prototype as SinkSelectableMediaElement).setSinkId === 'function'
}

function supportsDeviceChangeEvents(mediaDevices: BrowserMediaDevices): boolean {
  return (
    typeof mediaDevices.addEventListener === 'function' &&
    typeof mediaDevices.removeEventListener === 'function'
  )
}

function resolveMicrophonePermissionState(): Promise<LiveDevicePermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return Promise.resolve('unknown')
  }

  return navigator.permissions
    .query({ name: 'microphone' as PermissionName })
    .then((status) => {
      if (status.state === 'granted' || status.state === 'prompt' || status.state === 'denied') {
        return status.state
      }

      return 'unknown'
    })
    .catch(() => 'unknown')
}

function getDeviceId(device: MediaDeviceInfo, kind: LiveDeviceKind, index: number): string {
  return device.deviceId || `${kind}-${index + 1}`
}

function getDeviceLabel(device: MediaDeviceInfo, kind: LiveDeviceKind, index: number): string {
  const label = device.label.trim()
  if (label) {
    return label
  }

  return kind === 'microphone' ? `Microphone ${index + 1}` : `Speaker ${index + 1}`
}

function toLiveAudioDevice(
  device: MediaDeviceInfo,
  kind: LiveDeviceKind,
  index: number,
  useState: { selectedDeviceId: string | null; activeDeviceId: string | null },
): LiveAudioDevice {
  const id = getDeviceId(device, kind, index)

  return {
    id,
    kind,
    label: getDeviceLabel(device, kind, index),
    groupId: device.groupId || null,
    isDefault: device.deviceId === 'default',
    isSelected: useState.selectedDeviceId === id,
    isActive: useState.activeDeviceId === id,
  }
}

function mapDevices(
  devices: MediaDeviceInfo[],
  sourceKind: MediaDeviceKind,
  targetKind: LiveDeviceKind,
  useState: { selectedDeviceId: string | null; activeDeviceId: string | null },
): LiveAudioDevice[] {
  return devices
    .filter((device) => device.kind === sourceKind)
    .map((device, index) => toLiveAudioDevice(device, targetKind, index, useState))
}

function hasHiddenLabels(devices: MediaDeviceInfo[], kind: MediaDeviceKind): boolean {
  return devices.some((device) => device.kind === kind && device.label.trim() === '')
}

function getSystemAudioCapability(mediaDevices: BrowserMediaDevices): LiveDeviceCapabilityState {
  return typeof mediaDevices.getDisplayMedia === 'function' ? 'limited' : 'unsupported'
}

function buildUnsupportedInventory(
  state: LiveDeviceSelectionState,
  warning: LiveDeviceWarningCode,
): LiveDeviceInventory {
  const warnings = new Set<LiveDeviceWarningCode>([warning])
  if (isInsecureContext()) {
    warnings.add('insecure_context')
  }

  return {
    microphones: [],
    speakers: [],
    current: getCurrentState(state),
    permissions: {
      microphone: 'unsupported',
      speakerSelection: 'unsupported',
    },
    capabilities: {
      microphoneCapture: 'unsupported',
      speakerSelection: 'unsupported',
      systemAudioCapture: 'unsupported',
    },
    warnings: [...warnings],
  }
}

function buildMicrophoneConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
  }
}

function stopStreamTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

function permissionFailureFromError(error: unknown): LiveDevicePermissionResult {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return {
        state: 'denied',
        granted: false,
        warning: 'microphone_permission_denied',
      }
    }
  }

  return {
    state: 'unknown',
    granted: false,
    warning: 'microphone_permission_required',
  }
}

export class WebAudioDeviceRepository implements LiveAudioDeviceRepository {
  async listDevices(state: LiveDeviceSelectionState = {}): Promise<LiveDeviceInventory> {
    const mediaDevices = getBrowserMediaDevices()
    if (!mediaDevices?.enumerateDevices) {
      return buildUnsupportedInventory(state, 'media_devices_unsupported')
    }

    const current = getCurrentState(state)
    const warnings = new Set<LiveDeviceWarningCode>()

    if (isInsecureContext()) {
      addWarning(warnings, 'insecure_context')
    }

    const microphonePermission = await resolveMicrophonePermissionState()
    const speakerSelectionSupported = supportsSpeakerSelection()
    const deviceChangeSupported = supportsDeviceChangeEvents(mediaDevices)

    let devices: MediaDeviceInfo[]
    try {
      devices = await mediaDevices.enumerateDevices()
    } catch {
      return buildUnsupportedInventory(state, 'media_devices_unsupported')
    }

    const microphones = mapDevices(devices, 'audioinput', 'microphone', current.microphone)
    const speakers = mapDevices(devices, 'audiooutput', 'speaker', current.speaker)
    const systemAudioCapture = getSystemAudioCapability(mediaDevices)

    if (hasHiddenLabels(devices, 'audioinput') && microphonePermission !== 'granted') {
      addWarning(warnings, 'microphone_permission_required')
    }

    if (hasHiddenLabels(devices, 'audiooutput')) {
      addWarning(warnings, 'speaker_labels_hidden')
    }

    if (speakers.length === 0) {
      addWarning(warnings, 'speaker_enumeration_unsupported')
    }

    if (!speakerSelectionSupported) {
      addWarning(warnings, 'speaker_selection_unsupported')
    }

    if (!deviceChangeSupported) {
      addWarning(warnings, 'devicechange_unsupported')
    }

    if (systemAudioCapture === 'limited') {
      addWarning(warnings, 'system_audio_capture_limited')
    }

    return {
      microphones,
      speakers,
      current,
      permissions: {
        microphone: microphonePermission,
        speakerSelection: speakerSelectionSupported ? 'unknown' : 'unsupported',
      },
      capabilities: {
        microphoneCapture:
          typeof mediaDevices.getUserMedia === 'function' ? 'available' : 'unsupported',
        speakerSelection: speakerSelectionSupported ? 'available' : 'unsupported',
        systemAudioCapture,
      },
      warnings: [...warnings],
    }
  }

  async requestMicrophonePermission(deviceId?: string): Promise<LiveDevicePermissionResult> {
    const mediaDevices = getBrowserMediaDevices()
    if (!mediaDevices?.getUserMedia) {
      return {
        state: 'unsupported',
        granted: false,
        warning: isInsecureContext() ? 'insecure_context' : 'media_devices_unsupported',
      }
    }

    try {
      const stream = await mediaDevices.getUserMedia(buildMicrophoneConstraints(deviceId))
      stopStreamTracks(stream)
      return {
        state: 'granted',
        granted: true,
        warning: null,
      }
    } catch (error) {
      return permissionFailureFromError(error)
    }
  }

  subscribeToDeviceChanges(callback: LiveDeviceChangeCallback): () => void {
    const mediaDevices = getBrowserMediaDevices()
    if (!mediaDevices?.addEventListener || !mediaDevices.removeEventListener) {
      return () => undefined
    }

    mediaDevices.addEventListener('devicechange', callback)
    return () => {
      mediaDevices.removeEventListener('devicechange', callback)
    }
  }
}

export function createWebAudioDeviceRepository(): LiveAudioDeviceRepository {
  return new WebAudioDeviceRepository()
}
