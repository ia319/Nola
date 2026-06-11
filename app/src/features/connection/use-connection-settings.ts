import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import type { StoredConnectionConfig } from '@/config/connection/config'
import {
  DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN,
  type ConnectionProfile,
} from '@/config/connection/profile'
import type { ConnectionConfigRepository } from '@/config/connection/storage'
import type { RuntimeEnvironment } from '@/lib/runtime-environment'

import {
  checkConnectionHealth,
  hasConnectionSettingsChanges,
  loadConnectionSettingsSnapshot,
  normalizeConnectionSettingsDraft,
  resetConnectionSettings,
  saveConnectionSettings,
  type ConnectionCheckStatus,
  type ConnectionSettingsDraft,
  type ConnectionSettingsMode,
  type ConnectionSettingsSnapshot,
  type ConnectionSettingsWarning,
} from './settings-service'

export interface UseConnectionSettingsOptions {
  environment?: RuntimeEnvironment
  repository?: ConnectionConfigRepository
}

interface UseConnectionSettingsResult {
  draft: ConnectionSettingsDraft
  status: ConnectionCheckStatus
  isLoading: boolean
  isSaving: boolean
  isResetting: boolean
  isChecking: boolean
  errorMessage: string | null
  warningMessages: string[]
  hasChanges: boolean
  setMode(mode: ConnectionSettingsMode): void
  setHttpOrigin(httpOrigin: string): void
  save(): Promise<void>
  reset(): Promise<void>
  check(): Promise<void>
}

function createInitialDraft(): ConnectionSettingsDraft {
  return {
    mode: 'external-local',
    httpOrigin: DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN,
  }
}

function getStatusFromSnapshot(snapshot: ConnectionSettingsSnapshot): ConnectionCheckStatus {
  return snapshot.activeProfile ? 'not-checked' : 'unconfigured'
}

function getWarningMessageKey(warning: ConnectionSettingsWarning): string {
  switch (warning.code) {
    case 'invalid-managed-local-runtime-origin':
      return 'settings.connection.warnings.invalidManagedLocalRuntimeOrigin'
    case 'invalid-backend-runtime-url':
      return 'settings.connection.warnings.invalidBackendRuntimeUrl'
    case 'invalid-desktop-gateway-runtime-origin':
      return 'settings.connection.warnings.invalidDesktopGatewayRuntimeOrigin'
  }
}

export function useConnectionSettings(
  options: UseConnectionSettingsOptions = {},
): UseConnectionSettingsResult {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ConnectionSettingsDraft>(() => createInitialDraft())
  const [storedConfig, setStoredConfig] = useState<StoredConnectionConfig | null>(null)
  const [activeProfile, setActiveProfile] = useState<ConnectionProfile | null>(null)
  const [status, setStatus] = useState<ConnectionCheckStatus>('not-checked')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [warningMessages, setWarningMessages] = useState<string[]>([])

  const serviceOptions = useMemo(
    () => ({
      environment: options.environment,
      repository: options.repository,
    }),
    [options.environment, options.repository],
  )

  const formatWarningMessages = useCallback(
    (warnings: ConnectionSettingsWarning[]): string[] =>
      warnings.map((warning) => t(getWarningMessageKey(warning), { reason: warning.reason })),
    [t],
  )

  useEffect(() => {
    let mounted = true

    async function loadSnapshot(): Promise<void> {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const snapshot = await loadConnectionSettingsSnapshot(serviceOptions)
        if (!mounted) return
        setDraft(snapshot.draft)
        setStoredConfig(snapshot.storedConfig)
        setActiveProfile(snapshot.activeProfile)
        setStatus(getStatusFromSnapshot(snapshot))
        setWarningMessages(formatWarningMessages(snapshot.warnings))
      } catch (error) {
        if (!mounted) return
        setErrorMessage(
          error instanceof Error ? error.message : t('settings.connection.errors.load'),
        )
        setStatus('unconfigured')
        setWarningMessages([])
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSnapshot()

    return () => {
      mounted = false
    }
  }, [formatWarningMessages, serviceOptions, t])

  const hasChanges = useMemo(() => {
    try {
      return hasConnectionSettingsChanges(draft, storedConfig, activeProfile)
    } catch {
      return true
    }
  }, [activeProfile, draft, storedConfig])

  const setMode = useCallback((mode: ConnectionSettingsMode): void => {
    setDraft((current) => ({
      mode,
      httpOrigin:
        mode === 'external-local'
          ? DEFAULT_EXTERNAL_LOCAL_HTTP_ORIGIN
          : current.mode === 'remote'
            ? current.httpOrigin
            : '',
    }))
    setStatus('not-checked')
    setErrorMessage(null)
  }, [])

  const setHttpOrigin = useCallback((httpOrigin: string): void => {
    setDraft((current) => ({
      ...current,
      httpOrigin,
    }))
    setStatus('not-checked')
    setErrorMessage(null)
  }, [])

  const save = useCallback(async (): Promise<void> => {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const snapshot = await saveConnectionSettings(draft, serviceOptions)
      setDraft(snapshot.draft)
      setStoredConfig(snapshot.storedConfig)
      setActiveProfile(snapshot.activeProfile)
      setStatus(getStatusFromSnapshot(snapshot))
      setWarningMessages(formatWarningMessages(snapshot.warnings))
      toast.success(t('settings.connection.toast.saved'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('settings.connection.errors.save'))
    } finally {
      setIsSaving(false)
    }
  }, [draft, formatWarningMessages, serviceOptions, t])

  const reset = useCallback(async (): Promise<void> => {
    setIsResetting(true)
    setErrorMessage(null)

    try {
      const snapshot = await resetConnectionSettings(serviceOptions)
      setDraft(snapshot.draft)
      setStoredConfig(null)
      setActiveProfile(snapshot.activeProfile)
      setStatus(getStatusFromSnapshot(snapshot))
      setWarningMessages(formatWarningMessages(snapshot.warnings))
      toast.success(t('settings.connection.toast.reset'))
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('settings.connection.errors.reset'),
      )
    } finally {
      setIsResetting(false)
    }
  }, [formatWarningMessages, serviceOptions, t])

  const check = useCallback(async (): Promise<void> => {
    setIsChecking(true)
    setStatus('checking')
    setErrorMessage(null)

    try {
      const normalizedDraft = normalizeConnectionSettingsDraft(draft)
      const result = await checkConnectionHealth(normalizedDraft, serviceOptions)
      setDraft(normalizedDraft)
      setStatus(result.status)
    } catch (error) {
      setStatus('unreachable')
      setErrorMessage(
        error instanceof Error ? error.message : t('settings.connection.errors.check'),
      )
    } finally {
      setIsChecking(false)
    }
  }, [draft, serviceOptions, t])

  return {
    draft,
    status,
    isLoading,
    isSaving,
    isResetting,
    isChecking,
    errorMessage,
    warningMessages,
    hasChanges,
    setMode,
    setHttpOrigin,
    save,
    reset,
    check,
  }
}
