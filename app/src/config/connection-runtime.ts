import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'

import { getDefaultConnectionProfile, type ConnectionProfile } from './connection-profile'
import env from './env'

export type ConnectionProfileListener = (profile: ConnectionProfile | null) => void

let activeConnectionProfile: ConnectionProfile | null =
  getDefaultConnectionProfile(getRuntimeEnvironment())

const listeners = new Set<ConnectionProfileListener>()

export function getActiveConnectionProfile(): ConnectionProfile | null {
  return activeConnectionProfile
}

export function setActiveConnectionProfile(profile: ConnectionProfile | null): void {
  activeConnectionProfile = profile

  for (const listener of listeners) {
    listener(activeConnectionProfile)
  }
}

export function subscribeActiveConnectionProfile(listener: ConnectionProfileListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getActiveApiBaseUrl(): string {
  return activeConnectionProfile ? activeConnectionProfile.httpOrigin : env.apiBaseUrl
}

export function getActiveWebSocketBaseUrl(): string {
  return activeConnectionProfile
    ? activeConnectionProfile.wsOrigin
    : env.wsBaseUrl || env.apiBaseUrl
}

export function resetActiveConnectionProfile(environment?: RuntimeEnvironment): void {
  setActiveConnectionProfile(getDefaultConnectionProfile(environment ?? getRuntimeEnvironment()))
}
