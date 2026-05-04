import env from '@/config/env'
import logger from '@/config/logger'

import {
  createAudioDeviceRepository,
  type LiveAudioDeviceRepository,
  type LiveDeviceSelectionState,
} from './audio-device-repository'
import type { LiveDeviceInventory } from './types'

interface LiveDeviceDiagnostics {
  logInventory: (state?: LiveDeviceSelectionState) => Promise<LiveDeviceInventory | null>
}

type LiveDeviceDiagnosticWindow = Window & {
  __NOLA_LIVE_DEVICES__?: LiveDeviceDiagnostics
}

export async function logLiveDeviceInventory(
  state?: LiveDeviceSelectionState,
  repository?: LiveAudioDeviceRepository,
): Promise<LiveDeviceInventory | null> {
  if (!env.isDev) {
    return null
  }

  const deviceRepository = repository ?? (await createAudioDeviceRepository())
  const inventory = await deviceRepository.listDevices(state)
  logger.debug('Live device inventory', inventory)
  return inventory
}

export function installLiveDeviceDiagnostics(): void {
  if (!env.isDev || typeof window === 'undefined') {
    return
  }

  const diagnosticWindow = window as LiveDeviceDiagnosticWindow
  diagnosticWindow.__NOLA_LIVE_DEVICES__ = {
    logInventory: (state?: LiveDeviceSelectionState) => logLiveDeviceInventory(state),
  }
}
