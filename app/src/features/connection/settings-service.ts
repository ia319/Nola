import {
  CONNECTION_CONFIG_VERSION,
  createConnectionProfileFromConfig,
  type PersistedConnectionMode,
  type StoredConnectionConfig,
} from '@/config/connection/config'
import {
  createDesktopGatewayRemoteConnectionProfile,
  createExternalLocalConnectionProfile,
  createRemoteConnectionProfile,
  DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN,
  getDefaultConnectionProfile,
  type ConnectionProfile,
  type ConnectionStatus,
} from '@/config/connection/profile'
import {
  resolveConnectionProfile,
  resolveConnectionProfileWithDiagnostics,
  type ConnectionProfileResolutionWarning,
} from '@/config/connection/resolver'
import { getActiveConnectionProfile, setActiveConnectionProfile } from '@/config/connection/runtime'
import {
  createConnectionConfigRepository,
  type ConnectionConfigRepository,
} from '@/config/connection/storage'
import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'

export type ConnectionSettingsMode = PersistedConnectionMode

export type ConnectionCheckStatus = 'not-checked' | ConnectionStatus
export type ConnectionSettingsWarning = ConnectionProfileResolutionWarning

export interface ConnectionSettingsDraft {
  mode: ConnectionSettingsMode
  httpOrigin: string
}

export interface ConnectionSettingsSnapshot {
  activeProfile: ConnectionProfile | null
  storedConfig: StoredConnectionConfig | null
  draft: ConnectionSettingsDraft
  warnings: ConnectionSettingsWarning[]
}

export interface ConnectionSettingsServiceOptions {
  environment?: RuntimeEnvironment
  repository?: ConnectionConfigRepository
}

export interface ConnectionHealthCheckOptions {
  environment?: RuntimeEnvironment
  repository?: ConnectionConfigRepository
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export interface ConnectionHealthCheckResult {
  status: Exclude<ConnectionStatus, 'checking' | 'unconfigured' | 'realtime-failed'>
}

const CSP_EVENT_TYPES = new Set(['securitypolicyviolation'])
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 5_000

function getEnvironment(environment?: RuntimeEnvironment): RuntimeEnvironment {
  return environment ?? getRuntimeEnvironment()
}

function getRepository(
  repository?: ConnectionConfigRepository,
  environment?: RuntimeEnvironment,
): ConnectionConfigRepository {
  return repository ?? createConnectionConfigRepository(getEnvironment(environment))
}

function profileToDraft(profile: ConnectionProfile | null): ConnectionSettingsDraft {
  if (profile?.mode === 'remote') {
    return {
      mode: 'remote',
      httpOrigin: profile.targetHttpOrigin,
    }
  }

  return {
    mode: 'external-local',
    httpOrigin:
      profile?.mode === 'external-local' || profile?.mode === 'managed-local'
        ? profile.httpOrigin
        : DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN,
  }
}

function configToDraft(config: StoredConnectionConfig): ConnectionSettingsDraft {
  return {
    mode: config.mode,
    httpOrigin: config.httpOrigin,
  }
}

function toStoredConnectionConfig(draft: ConnectionSettingsDraft): StoredConnectionConfig {
  if (draft.mode === 'remote') {
    const profile = createRemoteConnectionProfile(draft.httpOrigin, 'user-config')
    return {
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: profile.httpOrigin,
    }
  }

  const profile = createExternalLocalConnectionProfile(draft.httpOrigin, 'user-config')
  return {
    version: CONNECTION_CONFIG_VERSION,
    mode: 'external-local',
    httpOrigin: profile.httpOrigin,
  }
}

function createActiveProfileFromConfig(config: StoredConnectionConfig): ConnectionProfile {
  const currentProfile = getActiveConnectionProfile()
  if (
    config.mode === 'remote' &&
    currentProfile?.mode === 'remote' &&
    currentProfile.transport === 'desktop-gateway'
  ) {
    return createDesktopGatewayRemoteConnectionProfile(
      config.httpOrigin,
      currentProfile.httpOrigin,
      'user-config',
    )
  }

  return createConnectionProfileFromConfig(config)
}

async function resolveSavedActiveProfile(
  config: StoredConnectionConfig,
  options: ConnectionSettingsServiceOptions,
): Promise<Pick<ConnectionSettingsSnapshot, 'activeProfile' | 'warnings'>> {
  const environment = getEnvironment(options.environment)
  if (environment === 'tauri') {
    const resolution = await resolveConnectionProfileWithDiagnostics({
      environment,
      repository: getRepository(options.repository, options.environment),
    })
    return {
      activeProfile: resolution.profile ?? createActiveProfileFromConfig(config),
      warnings: resolution.warnings,
    }
  }

  return {
    activeProfile: createConnectionProfileFromConfig(config),
    warnings: [],
  }
}

async function resolveDefaultActiveProfile(
  options: ConnectionSettingsServiceOptions,
): Promise<Pick<ConnectionSettingsSnapshot, 'activeProfile' | 'warnings'>> {
  const environment = getEnvironment(options.environment)
  if (environment === 'tauri') {
    const resolution = await resolveConnectionProfileWithDiagnostics({
      environment,
      repository: getRepository(options.repository, options.environment),
    })
    return {
      activeProfile: resolution.profile,
      warnings: resolution.warnings,
    }
  }

  return {
    activeProfile: getDefaultConnectionProfile(environment),
    warnings: [],
  }
}

function createProfileFromDraft(draft: ConnectionSettingsDraft): ConnectionProfile {
  return draft.mode === 'remote'
    ? createRemoteConnectionProfile(draft.httpOrigin, 'user-config')
    : createExternalLocalConnectionProfile(draft.httpOrigin, 'user-config')
}

async function createHealthCheckProfile(
  draft: ConnectionSettingsDraft,
  options: ConnectionHealthCheckOptions,
): Promise<ConnectionProfile> {
  const profile = createProfileFromDraft(draft)
  const environment = getEnvironment(options.environment)
  if (environment !== 'tauri' || profile.mode !== 'remote') {
    return profile
  }

  const currentProfile = getActiveConnectionProfile()
  if (
    currentProfile?.mode === 'remote' &&
    currentProfile.transport === 'desktop-gateway' &&
    currentProfile.targetHttpOrigin === profile.httpOrigin
  ) {
    return currentProfile
  }

  const repository = getRepository(options.repository, options.environment)
  const storedConfig = await repository.load()
  if (
    storedConfig &&
    isSameDraft(configToDraft(storedConfig), configToDraft(toStoredConnectionConfig(draft)))
  ) {
    return (await resolveConnectionProfile({ environment, repository })) ?? profile
  }

  return profile
}

function isSameDraft(left: ConnectionSettingsDraft, right: ConnectionSettingsDraft): boolean {
  return left.mode === right.mode && left.httpOrigin === right.httpOrigin
}

function buildEndpoint(origin: string, path: string): string {
  const url = new URL(path, origin)
  return url.toString()
}

export function isCspViolationForOrigin(event: Event, origin: string): boolean {
  if (!CSP_EVENT_TYPES.has(event.type)) return false
  const violation = event as SecurityPolicyViolationEvent
  if (!violation.blockedURI) return false

  try {
    return new URL(violation.blockedURI).origin === origin
  } catch {
    return false
  }
}

async function fetchWithMode(
  fetchImpl: typeof fetch,
  url: string,
  mode: RequestMode,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    return await fetchImpl(url, {
      method: 'GET',
      mode,
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function isReachableWithoutCors(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<boolean> {
  try {
    await fetchWithMode(fetchImpl, url, 'no-cors', timeoutMs)
    return true
  } catch {
    return false
  }
}

async function checkEndpoint(
  fetchImpl: typeof fetch,
  origin: string,
  path: string,
  timeoutMs: number,
): Promise<ConnectionHealthCheckResult['status']> {
  const url = buildEndpoint(origin, path)
  let cspBlocked = false
  const handleCspViolation = (event: Event) => {
    if (isCspViolationForOrigin(event, origin)) {
      cspBlocked = true
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('securitypolicyviolation', handleCspViolation)
  }

  try {
    const response = await fetchWithMode(fetchImpl, url, 'cors', timeoutMs)
    return response.ok ? 'available' : 'unreachable'
  } catch {
    if (cspBlocked) return 'csp-blocked'
    return (await isReachableWithoutCors(fetchImpl, url, timeoutMs))
      ? 'cors-blocked'
      : 'unreachable'
  } finally {
    if (typeof window !== 'undefined') {
      window.removeEventListener('securitypolicyviolation', handleCspViolation)
    }
  }
}

export async function loadConnectionSettingsSnapshot(
  options: ConnectionSettingsServiceOptions = {},
): Promise<ConnectionSettingsSnapshot> {
  const repository = getRepository(options.repository, options.environment)
  const environment = getEnvironment(options.environment)
  const storedConfig = await repository.load()
  const resolution = await resolveConnectionProfileWithDiagnostics({ environment, repository })
  const currentProfile = getActiveConnectionProfile()
  const activeProfile = currentProfile ?? resolution.profile

  return {
    activeProfile,
    storedConfig,
    draft: profileToDraft(activeProfile),
    warnings: resolution.warnings,
  }
}

export function normalizeConnectionSettingsDraft(
  draft: ConnectionSettingsDraft,
): ConnectionSettingsDraft {
  return configToDraft(toStoredConnectionConfig(draft))
}

export function hasConnectionSettingsChanges(
  draft: ConnectionSettingsDraft,
  storedConfig: StoredConnectionConfig | null,
  activeProfile: ConnectionProfile | null,
): boolean {
  let normalizedDraft: ConnectionSettingsDraft
  try {
    normalizedDraft = normalizeConnectionSettingsDraft(draft)
  } catch {
    return true
  }

  if (!storedConfig) {
    return activeProfile ? !isSameDraft(normalizedDraft, profileToDraft(activeProfile)) : true
  }

  return !isSameDraft(normalizedDraft, configToDraft(storedConfig))
}

export async function saveConnectionSettings(
  draft: ConnectionSettingsDraft,
  options: ConnectionSettingsServiceOptions = {},
): Promise<ConnectionSettingsSnapshot> {
  const repository = getRepository(options.repository, options.environment)
  const config = toStoredConnectionConfig(draft)
  await repository.save(config)
  const { activeProfile, warnings } = await resolveSavedActiveProfile(config, options)
  setActiveConnectionProfile(activeProfile)

  return {
    activeProfile,
    storedConfig: config,
    draft: configToDraft(config),
    warnings,
  }
}

export async function resetConnectionSettings(
  options: ConnectionSettingsServiceOptions = {},
): Promise<ConnectionSettingsSnapshot> {
  const repository = getRepository(options.repository, options.environment)
  await repository.clear()
  const { activeProfile, warnings } = await resolveDefaultActiveProfile(options)
  setActiveConnectionProfile(activeProfile)

  return {
    activeProfile,
    storedConfig: null,
    draft: profileToDraft(activeProfile),
    warnings,
  }
}

export async function checkConnectionHealth(
  draft: ConnectionSettingsDraft,
  options: ConnectionHealthCheckOptions = {},
): Promise<ConnectionHealthCheckResult> {
  const profile = await createHealthCheckProfile(draft, options)
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS
  const healthStatus = await checkEndpoint(fetchImpl, profile.httpOrigin, '/health', timeoutMs)

  if (healthStatus !== 'available') {
    return { status: healthStatus }
  }

  const apiStatus = await checkEndpoint(fetchImpl, profile.httpOrigin, '/api/config', timeoutMs)

  return {
    status: apiStatus === 'unreachable' ? 'api-unavailable' : apiStatus,
  }
}
