import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'
import { getDesktopConnectionRuntimeOptions } from '@/lib/tauri-api'

import { createConnectionProfileFromConfig } from './connection-config'
import {
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
    return createConnectionProfileFromHttpOrigin(runtimeOverrides.backendUrl, 'runtime-override')
  }

  const repository = options.repository ?? createConnectionConfigRepository(environment)
  const storedConfig = await repository.load()
  if (storedConfig) {
    return createConnectionProfileFromConfig(storedConfig)
  }

  return getDefaultConnectionProfile(environment)
}
