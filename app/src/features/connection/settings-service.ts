import {
  CONNECTION_CONFIG_VERSION,
  createConnectionProfileFromConfig,
  type PersistedConnectionMode,
  type StoredConnectionConfig,
} from '@/config/connection-config'
import {
  createDesktopGatewayRemoteConnectionProfile,
  createExternalLocalConnectionProfile,
  createRemoteConnectionProfile,
  DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN,
  getDefaultConnectionProfile,
  type ConnectionProfile,
  type ConnectionStatus,
} from '@/config/connection-profile'
import { resolveConnectionProfile } from '@/config/connection-profile-resolver'
import { getActiveConnectionProfile, setActiveConnectionProfile } from '@/config/connection-runtime'
import {
  createConnectionConfigRepository,
  type ConnectionConfigRepository,
} from '@/config/connection-config-storage'
import { getRuntimeEnvironment, type RuntimeEnvironment } from '@/lib/runtime-environment'

export type ConnectionSettingsMode = PersistedConnectionMode

export type ConnectionCheckStatus = 'not-checked' | ConnectionStatus

export interface ConnectionSettingsDraft {
  mode: ConnectionSettingsMode
  httpOrigin: string
}

export interface ConnectionSettingsSnapshot {
  activeProfile: ConnectionProfile | null
  storedConfig: StoredConnectionConfig | null
  draft: ConnectionSettingsDraft
}

export interface ConnectionSettingsServiceOptions {
  environment?: RuntimeEnvironment
  repository?: ConnectionConfigRepository
}

export interface ConnectionHealthCheckOptions {
  environment?: RuntimeEnvironment
  repository?: ConnectionConfigRepository
  fetchImpl?: typeof fetch
}

export interface ConnectionHealthCheckResult {
  status: Exclude<ConnectionStatus, 'checking' | 'unconfigured' | 'realtime-failed'>
}

const CSP_EVENT_TYPES = new Set(['securitypolicyviolation'])

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
): Promise<ConnectionProfile> {
  const environment = getEnvironment(options.environment)
  if (environment === 'tauri') {
    const resolvedProfile = await resolveConnectionProfile({
      environment,
      repository: getRepository(options.repository, options.environment),
    })
    return resolvedProfile ?? createActiveProfileFromConfig(config)
  }

  return createConnectionProfileFromConfig(config)
}

async function resolveDefaultActiveProfile(
  options: ConnectionSettingsServiceOptions,
): Promise<ConnectionProfile | null> {
  const environment = getEnvironment(options.environment)
  if (environment === 'tauri') {
    return resolveConnectionProfile({
      environment,
      repository: getRepository(options.repository, options.environment),
    })
  }

  return getDefaultConnectionProfile(environment)
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
): Promise<Response> {
  return fetchImpl(url, {
    method: 'GET',
    mode,
    cache: 'no-store',
  })
}

async function isReachableWithoutCors(fetchImpl: typeof fetch, url: string): Promise<boolean> {
  try {
    await fetchWithMode(fetchImpl, url, 'no-cors')
    return true
  } catch {
    return false
  }
}

async function checkEndpoint(
  fetchImpl: typeof fetch,
  origin: string,
  path: string,
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
    const response = await fetchWithMode(fetchImpl, url, 'cors')
    return response.ok ? 'available' : 'unreachable'
  } catch {
    if (cspBlocked) return 'csp-blocked'
    return (await isReachableWithoutCors(fetchImpl, url)) ? 'cors-blocked' : 'unreachable'
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
  let fallbackProfile = getDefaultConnectionProfile(environment)
  if (storedConfig) {
    try {
      fallbackProfile = createConnectionProfileFromConfig(storedConfig)
    } catch {
      fallbackProfile = getDefaultConnectionProfile(environment)
    }
  }
  const currentProfile = getActiveConnectionProfile()
  const activeProfile = currentProfile ?? fallbackProfile

  return {
    activeProfile,
    storedConfig,
    draft: profileToDraft(activeProfile),
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
): boolean {
  const normalizedDraft = normalizeConnectionSettingsDraft(draft)
  if (!storedConfig) {
    return !isSameDraft(normalizedDraft, {
      mode: 'external-local',
      httpOrigin: DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN,
    })
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
  const activeProfile = await resolveSavedActiveProfile(config, options)
  setActiveConnectionProfile(activeProfile)

  return {
    activeProfile,
    storedConfig: config,
    draft: configToDraft(config),
  }
}

export async function resetConnectionSettings(
  options: ConnectionSettingsServiceOptions = {},
): Promise<ConnectionSettingsSnapshot> {
  const repository = getRepository(options.repository, options.environment)
  await repository.clear()
  const activeProfile = await resolveDefaultActiveProfile(options)
  setActiveConnectionProfile(activeProfile)

  return {
    activeProfile,
    storedConfig: null,
    draft: profileToDraft(activeProfile),
  }
}

export async function checkConnectionHealth(
  draft: ConnectionSettingsDraft,
  options: ConnectionHealthCheckOptions = {},
): Promise<ConnectionHealthCheckResult> {
  const profile = await createHealthCheckProfile(draft, options)
  const fetchImpl = options.fetchImpl ?? fetch
  const healthStatus = await checkEndpoint(fetchImpl, profile.httpOrigin, '/health')

  if (healthStatus !== 'available') {
    return { status: healthStatus }
  }

  const apiStatus = await checkEndpoint(fetchImpl, profile.httpOrigin, '/api/config')

  return {
    status: apiStatus === 'unreachable' ? 'api-unavailable' : apiStatus,
  }
}
