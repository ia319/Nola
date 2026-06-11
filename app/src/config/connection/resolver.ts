import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'
import { getDesktopConnectionRuntimeOptions } from '@/lib/tauri-api'

import { createConnectionProfileFromConfig } from './config'
import {
  createDesktopGatewayRemoteConnectionProfile,
  createConnectionProfileFromHttpOrigin,
  createManagedLocalConnectionProfile,
  getDefaultConnectionProfile,
  type ConnectionProfile,
} from './profile'
import { createConnectionConfigRepository, type ConnectionConfigRepository } from './storage'

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

export type ConnectionProfileResolutionWarningCode =
  | 'invalid-managed-local-runtime-origin'
  | 'invalid-backend-runtime-url'
  | 'invalid-desktop-gateway-runtime-origin'

export interface ConnectionProfileResolutionWarning {
  code: ConnectionProfileResolutionWarningCode
  reason: string
}

export interface ConnectionProfileResolution {
  profile: ConnectionProfile | null
  warnings: ConnectionProfileResolutionWarning[]
}

function hasConfiguredValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function getErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown connection configuration error'
}

function createResolutionWarning(
  code: ConnectionProfileResolutionWarningCode,
  error: unknown,
): ConnectionProfileResolutionWarning {
  return {
    code,
    reason: getErrorReason(error),
  }
}

function applyDesktopGatewayIfAvailable(
  profile: ConnectionProfile,
  environment: RuntimeEnvironment,
  runtimeOverrides: ConnectionRuntimeOverrides,
  warnings: ConnectionProfileResolutionWarning[],
): ConnectionProfile {
  if (
    environment === 'tauri' &&
    profile.mode === 'remote' &&
    hasConfiguredValue(runtimeOverrides.gatewayHttpOrigin)
  ) {
    try {
      return createDesktopGatewayRemoteConnectionProfile(
        profile.targetHttpOrigin,
        runtimeOverrides.gatewayHttpOrigin,
        profile.source,
      )
    } catch (error) {
      warnings.push(createResolutionWarning('invalid-desktop-gateway-runtime-origin', error))
    }
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
  return (await resolveConnectionProfileWithDiagnostics(options)).profile
}

export async function resolveConnectionProfileWithDiagnostics(
  options: ResolveConnectionProfileOptions = {},
): Promise<ConnectionProfileResolution> {
  const environment = options.environment ?? getRuntimeEnvironment()
  const runtimeOverrides = options.runtimeOverrides ?? (await loadRuntimeOverrides(environment))
  const warnings: ConnectionProfileResolutionWarning[] = []

  if (environment === 'tauri' && hasConfiguredValue(runtimeOverrides.managedLocalHttpOrigin)) {
    try {
      return {
        profile: createManagedLocalConnectionProfile(runtimeOverrides.managedLocalHttpOrigin),
        warnings,
      }
    } catch (error) {
      warnings.push(createResolutionWarning('invalid-managed-local-runtime-origin', error))
    }
  }

  if (hasConfiguredValue(runtimeOverrides.backendUrl)) {
    try {
      const profile = createConnectionProfileFromHttpOrigin(
        runtimeOverrides.backendUrl,
        'runtime-override',
      )
      return {
        profile: applyDesktopGatewayIfAvailable(profile, environment, runtimeOverrides, warnings),
        warnings,
      }
    } catch (error) {
      warnings.push(createResolutionWarning('invalid-backend-runtime-url', error))
    }
  }

  const repository = options.repository ?? createConnectionConfigRepository(environment)
  const storedConfig = await repository.load()
  if (storedConfig) {
    const profile = createConnectionProfileFromConfig(storedConfig)
    return {
      profile: applyDesktopGatewayIfAvailable(profile, environment, runtimeOverrides, warnings),
      warnings,
    }
  }

  return {
    profile: getDefaultConnectionProfile(environment),
    warnings,
  }
}
