// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LiveAudioCaptureRepository } from '../../capture/audio-capture-repository'
import type {
  LiveAudioLevel,
  LiveAudioSourceKind,
  LiveCaptureErrorCode,
  LiveCaptureSession,
  LiveCaptureState,
  LiveCaptureStateChange,
  RealtimeAudioFrame,
} from '../../capture/types'
import type {
  LiveAudioDeviceRepository,
  LiveDeviceChangeCallback,
  LiveDevicePermissionResult,
  LiveDeviceSelectionState,
} from '../../devices/audio-device-repository'
import type { LiveDeviceInventory } from '../../devices/types'
import type { LiveTimestampMs, LiveUnsubscribe } from '../../types'
import { useLiveDeviceStore } from '../../store/live-device-store'
import { useLiveDeviceInventory } from '../useLiveDeviceInventory'

interface MockLiveCaptureSession extends LiveCaptureSession {
  emitLevel: (level: LiveAudioLevel) => void
  emitState: (state: LiveCaptureState, errorCode?: LiveCaptureErrorCode | null) => void
}

function buildInventory(warnings: LiveDeviceInventory['warnings'] = []): LiveDeviceInventory {
  return {
    microphones: [
      {
        id: 'mic-1',
        kind: 'microphone',
        label: 'Microphone 1',
        groupId: 'group-1',
        isTemporary: false,
        isDefault: false,
        isSelected: false,
        isActive: false,
      },
    ],
    speakers: [
      {
        id: 'speaker-1',
        kind: 'speaker',
        label: 'Speaker 1',
        groupId: 'group-2',
        isTemporary: false,
        isDefault: false,
        isSelected: false,
        isActive: false,
      },
    ],
    current: {
      microphone: {
        selectedDeviceId: null,
        activeDeviceId: null,
      },
      speaker: {
        selectedDeviceId: null,
        activeDeviceId: null,
      },
    },
    permissions: {
      microphone: 'unknown',
      speakerSelection: 'unsupported',
    },
    capabilities: {
      microphoneCapture: 'available',
      speakerSelection: 'unsupported',
      systemAudioCapture: 'limited',
    },
    warnings,
  }
}

function createDeviceRepository(
  inventory: LiveDeviceInventory,
  permissionResult: LiveDevicePermissionResult = {
    state: 'granted',
    granted: true,
    warning: null,
  },
): {
  repository: LiveAudioDeviceRepository
  listDevices: ReturnType<typeof vi.fn>
  requestMicrophonePermission: ReturnType<typeof vi.fn>
  emitDeviceChange: () => void
  unsubscribe: ReturnType<typeof vi.fn>
} {
  let deviceChangeCallback: LiveDeviceChangeCallback | null = null
  const unsubscribe = vi.fn()
  const listDevices = vi.fn<LiveAudioDeviceRepository['listDevices']>().mockResolvedValue(inventory)
  const requestMicrophonePermission = vi
    .fn<LiveAudioDeviceRepository['requestMicrophonePermission']>()
    .mockResolvedValue(permissionResult)

  return {
    repository: {
      listDevices,
      requestMicrophonePermission,
      subscribeToDeviceChanges: (callback) => {
        deviceChangeCallback = callback
        return unsubscribe
      },
    },
    listDevices,
    requestMicrophonePermission,
    emitDeviceChange: () => {
      deviceChangeCallback?.()
    },
    unsubscribe,
  }
}

function createCaptureSession(sourceKind: LiveAudioSourceKind, deviceId: string | null) {
  const levelCallbacks = new Set<(level: LiveAudioLevel) => void>()
  const audioFrameCallbacks = new Set<(frame: RealtimeAudioFrame) => void>()
  const stateCallbacks = new Set<(change: LiveCaptureStateChange) => void>()
  const session: MockLiveCaptureSession = {
    id: `${sourceKind}-session-1`,
    sourceKind,
    deviceId,
    state: 'capturing',
    startedAt: 1 as LiveTimestampMs,
    stop: vi.fn(async () => {
      session.emitState('stopped')
    }),
    pause: vi.fn(async () => {
      session.emitState('paused')
    }),
    resume: vi.fn(async () => {
      session.emitState('capturing')
    }),
    onLevel: (callback: (level: LiveAudioLevel) => void): LiveUnsubscribe => {
      levelCallbacks.add(callback)
      return () => {
        levelCallbacks.delete(callback)
      }
    },
    onAudioFrame: (callback: (frame: RealtimeAudioFrame) => void): LiveUnsubscribe => {
      audioFrameCallbacks.add(callback)
      return () => {
        audioFrameCallbacks.delete(callback)
      }
    },
    onStateChange: (callback: (change: LiveCaptureStateChange) => void): LiveUnsubscribe => {
      stateCallbacks.add(callback)
      return () => {
        stateCallbacks.delete(callback)
      }
    },
    emitLevel: (level: LiveAudioLevel) => {
      for (const callback of levelCallbacks) {
        callback(level)
      }
    },
    emitState: (state: LiveCaptureState, errorCode: LiveCaptureErrorCode | null = null) => {
      session.state = state
      const change: LiveCaptureStateChange = {
        state,
        changedAt: 1,
        errorCode,
      }
      for (const callback of stateCallbacks) {
        callback(change)
      }
    },
  }

  return session
}

function createCaptureRepository(
  microphoneSession = createCaptureSession('microphone', 'mic-1'),
  systemSession = createCaptureSession('system', null),
): {
  repository: LiveAudioCaptureRepository
  microphoneSession: MockLiveCaptureSession
  systemSession: MockLiveCaptureSession
} {
  return {
    repository: {
      startMicrophoneCapture: vi.fn().mockResolvedValue(microphoneSession),
      startSystemAudioCapture: vi.fn().mockResolvedValue(systemSession),
    },
    microphoneSession,
    systemSession,
  }
}

afterEach(() => {
  useLiveDeviceStore.getState().resetLiveDeviceState()
  vi.clearAllMocks()
})

describe('useLiveDeviceInventory', () => {
  it('refreshes device inventory through the repository boundary', async () => {
    const deviceRepository = createDeviceRepository(
      buildInventory(['system_audio_capture_limited']),
    )
    const captureRepository = createCaptureRepository()

    const { result } = renderHook(() =>
      useLiveDeviceInventory({
        autoRefresh: false,
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    await act(async () => {
      await result.current.refreshDevices()
    })

    expect(deviceRepository.listDevices).toHaveBeenCalledWith({
      selectedMicrophoneId: null,
      activeMicrophoneId: null,
      selectedSpeakerId: null,
      activeSpeakerId: null,
    } satisfies LiveDeviceSelectionState)
    expect(result.current.inventoryStatus).toBe('ready')
    expect(result.current.inventory?.warnings).toEqual(['system_audio_capture_limited'])
  })

  it('passes selected and active microphone state into inventory refresh', async () => {
    const deviceRepository = createDeviceRepository(buildInventory())
    const captureRepository = createCaptureRepository()

    const { result } = renderHook(() =>
      useLiveDeviceInventory({
        autoRefresh: false,
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    act(() => {
      result.current.selectMicrophone('mic-1')
    })
    await act(async () => {
      await result.current.startMicrophoneCapture()
      await result.current.refreshDevices()
    })

    expect(captureRepository.repository.startMicrophoneCapture).toHaveBeenCalledWith({
      deviceId: 'mic-1',
    })
    expect(deviceRepository.listDevices).toHaveBeenLastCalledWith({
      selectedMicrophoneId: 'mic-1',
      activeMicrophoneId: 'mic-1',
      selectedSpeakerId: null,
      activeSpeakerId: null,
    } satisfies LiveDeviceSelectionState)
  })

  it('clears active microphone state when microphone capture stops', async () => {
    const deviceRepository = createDeviceRepository(buildInventory())
    const captureRepository = createCaptureRepository()

    const { result } = renderHook(() =>
      useLiveDeviceInventory({
        autoRefresh: false,
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    act(() => {
      result.current.selectMicrophone('mic-1')
    })
    await act(async () => {
      await result.current.startMicrophoneCapture()
    })
    expect(result.current.activeMicrophoneId).toBe('mic-1')

    await act(async () => {
      await result.current.stopMicrophoneCapture()
    })

    expect(captureRepository.microphoneSession.stop).toHaveBeenCalledTimes(1)
    expect(result.current.activeMicrophoneId).toBeNull()
    expect(result.current.microphoneCapture.state).toBe('stopped')
  })

  it('keeps a failed microphone stop retryable and writes structured failure state', async () => {
    const deviceRepository = createDeviceRepository(buildInventory())
    const captureRepository = createCaptureRepository()

    const { result } = renderHook(() =>
      useLiveDeviceInventory({
        autoRefresh: false,
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    await act(async () => {
      await result.current.startMicrophoneCapture()
    })

    vi.mocked(captureRepository.microphoneSession.stop).mockImplementationOnce(async () => {
      captureRepository.microphoneSession.emitState('stopping')
      throw new Error('stop failed')
    })

    await act(async () => {
      await result.current.stopMicrophoneCapture()
    })

    expect(result.current.activeMicrophoneId).toBeNull()
    expect(result.current.microphoneCapture).toMatchObject({
      state: 'failed',
      errorCode: 'microphone_capture_failed',
    })

    await act(async () => {
      await result.current.stopMicrophoneCapture()
    })

    expect(captureRepository.microphoneSession.stop).toHaveBeenCalledTimes(2)
    expect(result.current.microphoneCapture.state).toBe('stopped')
  })

  it('keeps system audio capture independent from speaker selection', async () => {
    const deviceRepository = createDeviceRepository(buildInventory())
    const captureRepository = createCaptureRepository()

    const { result } = renderHook(() =>
      useLiveDeviceInventory({
        autoRefresh: false,
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    act(() => {
      result.current.selectSpeaker('speaker-1')
    })
    await act(async () => {
      await result.current.startSystemAudioCapture()
    })

    expect(result.current.selectedSpeakerId).toBe('speaker-1')
    expect(result.current.systemAudioCapture).toMatchObject({
      sessionId: 'system-session-1',
      sourceKind: 'system',
      state: 'capturing',
      deviceId: null,
    })

    await act(async () => {
      await result.current.stopSystemAudioCapture()
    })

    expect(captureRepository.systemSession.stop).toHaveBeenCalledTimes(1)
    expect(result.current.selectedSpeakerId).toBe('speaker-1')
    expect(result.current.systemAudioCapture.state).toBe('stopped')
  })

  it('treats stop without an active session as an idempotent local cleanup', async () => {
    const deviceRepository = createDeviceRepository(buildInventory())
    const captureRepository = createCaptureRepository()

    const { result } = renderHook(() =>
      useLiveDeviceInventory({
        autoRefresh: false,
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    act(() => {
      result.current.selectMicrophone('mic-1')
    })
    await act(async () => {
      await result.current.stopMicrophoneCapture()
      await result.current.stopSystemAudioCapture()
    })

    expect(result.current.selectedMicrophoneId).toBe('mic-1')
    expect(result.current.microphoneCapture.state).toBe('idle')
    expect(result.current.systemAudioCapture.state).toBe('idle')
    expect(deviceRepository.listDevices).not.toHaveBeenCalled()
  })

  it('requests microphone permission through the current selected microphone', async () => {
    const deviceRepository = createDeviceRepository(buildInventory())
    const captureRepository = createCaptureRepository()

    const { result } = renderHook(() =>
      useLiveDeviceInventory({
        autoRefresh: false,
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    act(() => {
      result.current.selectMicrophone('mic-1')
    })
    await act(async () => {
      await result.current.requestMicrophonePermission()
    })

    expect(deviceRepository.requestMicrophonePermission).toHaveBeenCalledWith('mic-1')
    expect(result.current.lastMicrophonePermission).toEqual({
      state: 'granted',
      granted: true,
      warning: null,
    })
  })

  it('subscribes to devicechange during auto refresh and cleans up on unmount', async () => {
    const deviceRepository = createDeviceRepository(buildInventory())
    const captureRepository = createCaptureRepository()

    const { unmount } = renderHook(() =>
      useLiveDeviceInventory({
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    await waitFor(() => {
      expect(deviceRepository.listDevices).toHaveBeenCalledTimes(1)
    })

    act(() => {
      deviceRepository.emitDeviceChange()
    })
    await waitFor(() => {
      expect(deviceRepository.listDevices).toHaveBeenCalledTimes(2)
    })

    unmount()
    expect(deviceRepository.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('stops active capture sessions on hook unmount', async () => {
    const deviceRepository = createDeviceRepository(buildInventory())
    const captureRepository = createCaptureRepository()

    const { result, unmount } = renderHook(() =>
      useLiveDeviceInventory({
        autoRefresh: false,
        deviceRepositoryFactory: async () => deviceRepository.repository,
        captureRepositoryFactory: async () => captureRepository.repository,
      }),
    )

    await act(async () => {
      await result.current.startMicrophoneCapture()
      await result.current.startSystemAudioCapture()
    })

    unmount()

    await waitFor(() => {
      expect(captureRepository.microphoneSession.stop).toHaveBeenCalledTimes(1)
      expect(captureRepository.systemSession.stop).toHaveBeenCalledTimes(1)
    })
  })
})
