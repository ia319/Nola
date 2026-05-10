import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

import type { LiveAudioCaptureRepository } from '../capture/audio-capture-repository'
import { createAudioCaptureRepository } from '../capture/audio-capture-repository'
import { LiveCaptureError } from '../capture/errors'
import type {
  LiveCaptureErrorCode,
  LiveCaptureSession,
  LiveCaptureStateChange,
  LiveMicrophoneCaptureOptions,
  LiveSystemAudioCaptureOptions,
} from '../capture/types'
import type {
  LiveAudioDeviceRepository,
  LiveDevicePermissionResult,
} from '../devices/audio-device-repository'
import { createAudioDeviceRepository } from '../devices/audio-device-repository'
import type { LiveDeviceInventory } from '../devices/types'
import type { LiveUnsubscribe } from '../types'
import {
  getLiveDeviceSelectionState,
  useLiveDeviceStore,
  type LiveCaptureSlotState,
  type LiveDeviceInventoryErrorCode,
  type LiveDeviceInventoryStatus,
} from '../store/live-device-store'

export interface UseLiveDeviceInventoryOptions {
  autoRefresh?: boolean
  deviceRepositoryFactory?: () => Promise<LiveAudioDeviceRepository>
  captureRepositoryFactory?: () => Promise<LiveAudioCaptureRepository>
}

export interface UseLiveDeviceInventoryReturn {
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
  selectMicrophone: (deviceId: string | null) => void
  selectSpeaker: (deviceId: string | null) => void
  setActiveSpeaker: (deviceId: string | null) => void
  refreshDevices: () => Promise<LiveDeviceInventory | null>
  requestMicrophonePermission: (deviceId?: string | null) => Promise<LiveDevicePermissionResult>
  startMicrophoneCapture: (options?: LiveMicrophoneCaptureOptions) => Promise<void>
  stopMicrophoneCapture: () => Promise<void>
  pauseMicrophoneCapture: () => Promise<void>
  resumeMicrophoneCapture: () => Promise<void>
  startSystemAudioCapture: (options?: LiveSystemAudioCaptureOptions) => Promise<void>
  stopSystemAudioCapture: () => Promise<void>
  pauseSystemAudioCapture: () => Promise<void>
  resumeSystemAudioCapture: () => Promise<void>
}

type CaptureSlotKind = 'microphone' | 'system'
type StopCaptureSessionResult = 'missing' | 'stopped' | 'failed'

const FALLBACK_MICROPHONE_PERMISSION_DENIED: LiveDevicePermissionResult = {
  state: 'unknown',
  granted: false,
  warning: 'microphone_permission_required',
}

function getCaptureErrorCode(error: unknown, fallback: LiveCaptureErrorCode): LiveCaptureErrorCode {
  if (error instanceof LiveCaptureError) {
    return error.code
  }

  return fallback
}

function runUnsubscribers(unsubscribers: MutableRefObject<LiveUnsubscribe[]>): void {
  for (const unsubscribe of unsubscribers.current) {
    unsubscribe()
  }
  unsubscribers.current = []
}

function createStoppedCaptureStateChange(): LiveCaptureStateChange {
  return {
    state: 'stopped',
    changedAt: Date.now(),
    errorCode: null,
  }
}

export function useLiveDeviceInventory(
  options: UseLiveDeviceInventoryOptions = {},
): UseLiveDeviceInventoryReturn {
  const autoRefresh = options.autoRefresh ?? true
  const deviceRepositoryFactory = options.deviceRepositoryFactory ?? createAudioDeviceRepository
  const captureRepositoryFactory = options.captureRepositoryFactory ?? createAudioCaptureRepository

  const inventory = useLiveDeviceStore((state) => state.inventory)
  const inventoryStatus = useLiveDeviceStore((state) => state.inventoryStatus)
  const inventoryError = useLiveDeviceStore((state) => state.inventoryError)
  const lastMicrophonePermission = useLiveDeviceStore((state) => state.lastMicrophonePermission)
  const selectedMicrophoneId = useLiveDeviceStore((state) => state.selectedMicrophoneId)
  const selectedSpeakerId = useLiveDeviceStore((state) => state.selectedSpeakerId)
  const activeMicrophoneId = useLiveDeviceStore((state) => state.activeMicrophoneId)
  const activeSpeakerId = useLiveDeviceStore((state) => state.activeSpeakerId)
  const microphoneCapture = useLiveDeviceStore((state) => state.microphoneCapture)
  const systemAudioCapture = useLiveDeviceStore((state) => state.systemAudioCapture)
  const setSelectedMicrophoneId = useLiveDeviceStore((state) => state.setSelectedMicrophoneId)
  const setSelectedSpeakerId = useLiveDeviceStore((state) => state.setSelectedSpeakerId)
  const setActiveSpeakerId = useLiveDeviceStore((state) => state.setActiveSpeakerId)
  const setInventoryLoading = useLiveDeviceStore((state) => state.setInventoryLoading)
  const setInventoryReady = useLiveDeviceStore((state) => state.setInventoryReady)
  const setInventoryError = useLiveDeviceStore((state) => state.setInventoryError)
  const setLastMicrophonePermission = useLiveDeviceStore(
    (state) => state.setLastMicrophonePermission,
  )
  const setMicrophoneCaptureStarting = useLiveDeviceStore(
    (state) => state.setMicrophoneCaptureStarting,
  )
  const setMicrophoneCaptureSession = useLiveDeviceStore(
    (state) => state.setMicrophoneCaptureSession,
  )
  const setMicrophoneCaptureState = useLiveDeviceStore((state) => state.setMicrophoneCaptureState)
  const setMicrophoneCaptureFailure = useLiveDeviceStore(
    (state) => state.setMicrophoneCaptureFailure,
  )
  const setMicrophoneLevel = useLiveDeviceStore((state) => state.setMicrophoneLevel)
  const clearMicrophoneCapture = useLiveDeviceStore((state) => state.clearMicrophoneCapture)
  const setSystemAudioCaptureStarting = useLiveDeviceStore(
    (state) => state.setSystemAudioCaptureStarting,
  )
  const setSystemAudioCaptureSession = useLiveDeviceStore(
    (state) => state.setSystemAudioCaptureSession,
  )
  const setSystemAudioCaptureState = useLiveDeviceStore((state) => state.setSystemAudioCaptureState)
  const setSystemAudioCaptureFailure = useLiveDeviceStore(
    (state) => state.setSystemAudioCaptureFailure,
  )
  const setSystemAudioLevel = useLiveDeviceStore((state) => state.setSystemAudioLevel)
  const clearSystemAudioCapture = useLiveDeviceStore((state) => state.clearSystemAudioCapture)

  const deviceRepositoryRef = useRef<Promise<LiveAudioDeviceRepository> | null>(null)
  const captureRepositoryRef = useRef<Promise<LiveAudioCaptureRepository> | null>(null)
  const deviceRepositoryFactoryRef = useRef(deviceRepositoryFactory)
  const captureRepositoryFactoryRef = useRef(captureRepositoryFactory)
  const refreshSequenceRef = useRef(0)
  const microphoneSessionRef = useRef<LiveCaptureSession | null>(null)
  const systemAudioSessionRef = useRef<LiveCaptureSession | null>(null)
  const microphoneUnsubscribersRef = useRef<LiveUnsubscribe[]>([])
  const systemAudioUnsubscribersRef = useRef<LiveUnsubscribe[]>([])
  const releaseActiveCaptureSessionsRef = useRef<() => void>(() => undefined)

  const getDeviceRepository = useCallback(() => {
    if (!deviceRepositoryRef.current) {
      const repositoryPromise = deviceRepositoryFactoryRef.current().catch((error: unknown) => {
        if (deviceRepositoryRef.current === repositoryPromise) {
          deviceRepositoryRef.current = null
        }
        throw error
      })
      deviceRepositoryRef.current = repositoryPromise
    }

    return deviceRepositoryRef.current
  }, [])

  const getCaptureRepository = useCallback(() => {
    if (!captureRepositoryRef.current) {
      const repositoryPromise = captureRepositoryFactoryRef.current().catch((error: unknown) => {
        if (captureRepositoryRef.current === repositoryPromise) {
          captureRepositoryRef.current = null
        }
        throw error
      })
      captureRepositoryRef.current = repositoryPromise
    }

    return captureRepositoryRef.current
  }, [])

  // Keep factory injection fresh without making repository callbacks unstable.
  // Repository instances remain cached for the hook lifetime after creation.
  useEffect(() => {
    deviceRepositoryFactoryRef.current = deviceRepositoryFactory
  }, [deviceRepositoryFactory])

  useEffect(() => {
    captureRepositoryFactoryRef.current = captureRepositoryFactory
  }, [captureRepositoryFactory])

  const refreshDevices = useCallback(async (): Promise<LiveDeviceInventory | null> => {
    const sequence = refreshSequenceRef.current + 1
    refreshSequenceRef.current = sequence
    setInventoryLoading()

    try {
      const repository = await getDeviceRepository()
      const state = useLiveDeviceStore.getState()
      const nextInventory = await repository.listDevices(getLiveDeviceSelectionState(state))

      if (refreshSequenceRef.current === sequence) {
        setInventoryReady(nextInventory)
      }

      return nextInventory
    } catch {
      if (refreshSequenceRef.current === sequence) {
        setInventoryError('device_inventory_failed')
      }

      return null
    }
  }, [getDeviceRepository, setInventoryError, setInventoryLoading, setInventoryReady])

  const requestMicrophonePermission = useCallback(
    async (deviceId?: string | null): Promise<LiveDevicePermissionResult> => {
      try {
        const repository = await getDeviceRepository()
        const fallbackDeviceId = useLiveDeviceStore.getState().selectedMicrophoneId
        const result = await repository.requestMicrophonePermission(
          deviceId ?? fallbackDeviceId ?? undefined,
        )
        setLastMicrophonePermission(result)
        void refreshDevices()
        return result
      } catch {
        setLastMicrophonePermission(FALLBACK_MICROPHONE_PERMISSION_DENIED)
        return FALLBACK_MICROPHONE_PERMISSION_DENIED
      }
    },
    [getDeviceRepository, refreshDevices, setLastMicrophonePermission],
  )

  const detachCaptureSession = useCallback((kind: CaptureSlotKind) => {
    if (kind === 'microphone') {
      runUnsubscribers(microphoneUnsubscribersRef)
      microphoneSessionRef.current = null
      return
    }

    runUnsubscribers(systemAudioUnsubscribersRef)
    systemAudioSessionRef.current = null
  }, [])

  const bindCaptureSession = useCallback(
    (kind: CaptureSlotKind, session: LiveCaptureSession) => {
      detachCaptureSession(kind)

      if (kind === 'microphone') {
        microphoneSessionRef.current = session
        microphoneUnsubscribersRef.current = [
          session.onLevel(setMicrophoneLevel),
          session.onStateChange((change) => {
            setMicrophoneCaptureState(change)
            if (change.state === 'failed') {
              detachCaptureSession('microphone')
              void refreshDevices()
            }
          }),
        ]
        setMicrophoneCaptureSession({
          sessionId: session.id,
          deviceId: session.deviceId,
          startedAt: session.startedAt,
        })
        return
      }

      systemAudioSessionRef.current = session
      systemAudioUnsubscribersRef.current = [
        session.onLevel(setSystemAudioLevel),
        session.onStateChange((change) => {
          setSystemAudioCaptureState(change)
          if (change.state === 'failed') {
            detachCaptureSession('system')
            void refreshDevices()
          }
        }),
      ]
      setSystemAudioCaptureSession({
        sessionId: session.id,
        deviceId: session.deviceId,
        startedAt: session.startedAt,
      })
    },
    [
      detachCaptureSession,
      refreshDevices,
      setMicrophoneCaptureSession,
      setMicrophoneCaptureState,
      setMicrophoneLevel,
      setSystemAudioCaptureSession,
      setSystemAudioCaptureState,
      setSystemAudioLevel,
    ],
  )

  const stopMicrophoneSession = useCallback(
    async (refreshAfterStop: boolean): Promise<StopCaptureSessionResult> => {
      const session = microphoneSessionRef.current
      if (!session) {
        return 'missing'
      }

      try {
        await session.stop()
      } catch {
        setMicrophoneCaptureFailure('microphone_capture_failed')
        if (refreshAfterStop) {
          void refreshDevices()
        }
        return 'failed'
      }

      if (session.state !== 'stopped') {
        setMicrophoneCaptureState(createStoppedCaptureStateChange())
      }
      detachCaptureSession('microphone')
      if (refreshAfterStop) {
        void refreshDevices()
      }

      return 'stopped'
    },
    [detachCaptureSession, refreshDevices, setMicrophoneCaptureFailure, setMicrophoneCaptureState],
  )

  const stopMicrophoneCapture = useCallback(async (): Promise<void> => {
    const result = await stopMicrophoneSession(true)
    if (result === 'missing') {
      clearMicrophoneCapture()
    }
  }, [clearMicrophoneCapture, stopMicrophoneSession])

  const stopSystemAudioSession = useCallback(
    async (refreshAfterStop: boolean): Promise<StopCaptureSessionResult> => {
      const session = systemAudioSessionRef.current
      if (!session) {
        return 'missing'
      }

      try {
        await session.stop()
      } catch {
        setSystemAudioCaptureFailure('system_audio_capture_failed')
        if (refreshAfterStop) {
          void refreshDevices()
        }
        return 'failed'
      }

      if (session.state !== 'stopped') {
        setSystemAudioCaptureState(createStoppedCaptureStateChange())
      }
      detachCaptureSession('system')
      if (refreshAfterStop) {
        void refreshDevices()
      }

      return 'stopped'
    },
    [
      detachCaptureSession,
      refreshDevices,
      setSystemAudioCaptureFailure,
      setSystemAudioCaptureState,
    ],
  )

  const stopSystemAudioCapture = useCallback(async (): Promise<void> => {
    const result = await stopSystemAudioSession(true)
    if (result === 'missing') {
      clearSystemAudioCapture()
    }
  }, [clearSystemAudioCapture, stopSystemAudioSession])

  const releaseActiveCaptureSessions = useCallback((): void => {
    void stopMicrophoneSession(false)
    void stopSystemAudioSession(false)
  }, [stopMicrophoneSession, stopSystemAudioSession])

  useEffect(() => {
    releaseActiveCaptureSessionsRef.current = releaseActiveCaptureSessions
  }, [releaseActiveCaptureSessions])

  const startMicrophoneCapture = useCallback(
    async (captureOptions: LiveMicrophoneCaptureOptions = {}): Promise<void> => {
      const stopResult = await stopMicrophoneSession(false)
      if (stopResult === 'failed') {
        return
      }

      const state = useLiveDeviceStore.getState()
      const deviceId =
        captureOptions.deviceId !== undefined ? captureOptions.deviceId : state.selectedMicrophoneId

      setMicrophoneCaptureStarting(deviceId ?? null)

      try {
        const repository = await getCaptureRepository()
        const session = await repository.startMicrophoneCapture({
          ...captureOptions,
          deviceId,
        })
        bindCaptureSession('microphone', session)
        void refreshDevices()
      } catch (error) {
        const errorCode = getCaptureErrorCode(error, 'microphone_capture_failed')
        setMicrophoneCaptureFailure(errorCode)
      }
    },
    [
      bindCaptureSession,
      getCaptureRepository,
      refreshDevices,
      setMicrophoneCaptureFailure,
      setMicrophoneCaptureStarting,
      stopMicrophoneSession,
    ],
  )

  const startSystemAudioCapture = useCallback(
    async (captureOptions: LiveSystemAudioCaptureOptions = {}): Promise<void> => {
      const stopResult = await stopSystemAudioSession(false)
      if (stopResult === 'failed') {
        return
      }

      setSystemAudioCaptureStarting()

      try {
        const repository = await getCaptureRepository()
        const session = await repository.startSystemAudioCapture(captureOptions)
        bindCaptureSession('system', session)
        void refreshDevices()
      } catch (error) {
        const errorCode = getCaptureErrorCode(error, 'system_audio_capture_failed')
        setSystemAudioCaptureFailure(errorCode)
      }
    },
    [
      bindCaptureSession,
      getCaptureRepository,
      refreshDevices,
      setSystemAudioCaptureFailure,
      setSystemAudioCaptureStarting,
      stopSystemAudioSession,
    ],
  )

  const pauseMicrophoneCapture = useCallback(async (): Promise<void> => {
    await microphoneSessionRef.current?.pause()
  }, [])

  const resumeMicrophoneCapture = useCallback(async (): Promise<void> => {
    await microphoneSessionRef.current?.resume()
  }, [])

  const pauseSystemAudioCapture = useCallback(async (): Promise<void> => {
    await systemAudioSessionRef.current?.pause()
  }, [])

  const resumeSystemAudioCapture = useCallback(async (): Promise<void> => {
    await systemAudioSessionRef.current?.resume()
  }, [])

  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    let unsubscribe: LiveUnsubscribe | null = null
    let disposed = false

    void refreshDevices()
    void getDeviceRepository()
      .then((repository) => {
        if (disposed) return
        unsubscribe = repository.subscribeToDeviceChanges(() => {
          void refreshDevices()
        })
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [autoRefresh, getDeviceRepository, refreshDevices])

  useEffect(() => {
    return () => {
      releaseActiveCaptureSessionsRef.current()
    }
  }, [])

  return {
    inventory,
    inventoryStatus,
    inventoryError,
    lastMicrophonePermission,
    selectedMicrophoneId,
    selectedSpeakerId,
    activeMicrophoneId,
    activeSpeakerId,
    microphoneCapture,
    systemAudioCapture,
    selectMicrophone: setSelectedMicrophoneId,
    selectSpeaker: setSelectedSpeakerId,
    setActiveSpeaker: setActiveSpeakerId,
    refreshDevices,
    requestMicrophonePermission,
    startMicrophoneCapture,
    stopMicrophoneCapture,
    pauseMicrophoneCapture,
    resumeMicrophoneCapture,
    startSystemAudioCapture,
    stopSystemAudioCapture,
    pauseSystemAudioCapture,
    resumeSystemAudioCapture,
  }
}
