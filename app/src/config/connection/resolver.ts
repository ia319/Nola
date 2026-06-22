import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'
import {
  getDesktopConnectionRuntimeOptions,
  type DesktopCoreSidecarRuntimeStatusDto,
} from '@/lib/tauri-api'

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
  coreSidecarStatus?: DesktopCoreSidecarRuntimeStatusDto | null
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
  | 'desktop-core-sidecar-unavailable'
  | 'desktop-core-sidecar-degraded'

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

function createDesktopCoreSidecarReason(status: DesktopCoreSidecarRuntimeStatusDto): string {
  const statusSummary = `API=${status.apiStatus}, worker=${status.workerStatus}`
  const reason = status.error ?? statusSummary
  return status.logDir ? `${reason} Logs: ${status.logDir}` : reason
}

function addDesktopCoreSidecarWarnings(
  status: DesktopCoreSidecarRuntimeStatusDto | null | undefined,
  warnings: ConnectionProfileResolutionWarning[],
): void {
  if (!status) return

  if (status.mode === 'unavailable') {
    warnings.push({
      code: 'desktop-core-sidecar-unavailable',
      reason: createDesktopCoreSidecarReason(status),
    })
    return
  }

  if (status.mode !== 'managed-local') return

  if (status.apiStatus !== 'available') {
    warnings.push({
      code: 'desktop-core-sidecar-unavailable',
      reason: createDesktopCoreSidecarReason(status),
    })
    return
  }

  if (status.workerStatus !== 'available') {
    warnings.push({
      code: 'desktop-core-sidecar-degraded',
      reason: createDesktopCoreSidecarReason(status),
    })
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

  if (environment === 'tauri') {
    addDesktopCoreSidecarWarnings(runtimeOverrides.coreSidecarStatus, warnings)
  }

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

  return {
    profile: getDefaultConnectionProfile(environment),
    warnings,
  }
}
