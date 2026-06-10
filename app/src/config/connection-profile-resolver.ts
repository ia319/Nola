import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'
import { getDesktopConnectionRuntimeOptions } from '@/lib/tauri-api'

import { createConnectionProfileFromConfig } from './connection-config'
import {
  createDesktopGatewayRemoteConnectionProfile,
  createConnectionProfileFromHttpOrigin,
  createManagedLocalConnectionProfile,
  getDefaultConnectionProfile,
  type ConnectionProfile,
} from './connection-profile'
import {
  createConnectionConfigRepository,
  type ConnectionConfigRepository,
} from './connection-config-storage'

export interface ConnectionRuntimeOverrides {
  managedLocalHttpOrigin?: string | null
  gatewayHttpOrigin?: string | null
  backendUrl?: string | null
}

export interface ResolveConnectionProfileOptions {
  environment?: RuntimeEnvironment
  repository?: ConnectionConfigRepository
  runtimeOverrides?: ConnectionRuntimeOverrides
}

function hasConfiguredValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function applyDesktopGatewayIfAvailable(
  profile: ConnectionProfile,
  environment: RuntimeEnvironment,
  runtimeOverrides: ConnectionRuntimeOverrides,
): ConnectionProfile {
  if (
    environment === 'tauri' &&
    profile.mode === 'remote' &&
    hasConfiguredValue(runtimeOverrides.gatewayHttpOrigin)
  ) {
    return createDesktopGatewayRemoteConnectionProfile(
      profile.targetHttpOrigin,
      runtimeOverrides.gatewayHttpOrigin,
      profile.source,
    )
  }

  return profile
}

async function loadRuntimeOverrides(
  environment: RuntimeEnvironment,
): Promise<ConnectionRuntimeOverrides> {
  if (environment !== 'tauri') {
    return {}
  }

  try {
    return await getDesktopConnectionRuntimeOptions()
  } catch {
    return {}
  }
}

export async function resolveConnectionProfile(
  options: ResolveConnectionProfileOptions = {},
): Promise<ConnectionProfile | null> {
  const environment = options.environment ?? getRuntimeEnvironment()
  const runtimeOverrides = options.runtimeOverrides ?? (await loadRuntimeOverrides(environment))

  if (environment === 'tauri' && hasConfiguredValue(runtimeOverrides.managedLocalHttpOrigin)) {
    return createManagedLocalConnectionProfile(runtimeOverrides.managedLocalHttpOrigin)
  }

  if (hasConfiguredValue(runtimeOverrides.backendUrl)) {
    const profile = createConnectionProfileFromHttpOrigin(
      runtimeOverrides.backendUrl,
      'runtime-override',
    )
    return applyDesktopGatewayIfAvailable(profile, environment, runtimeOverrides)
  }

  const repository = options.repository ?? createConnectionConfigRepository(environment)
  const storedConfig = await repository.load()
  if (storedConfig) {
    const profile = createConnectionProfileFromConfig(storedConfig)
    return applyDesktopGatewayIfAvailable(profile, environment, runtimeOverrides)
  }

  return getDefaultConnectionProfile(environment)
}
