import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, Maximize2, Minimize2, PictureInPicture2, Play, Square } from 'lucide-react'

import { Button } from '@/components/ui'
import {
  deleteLiveRealtimeDefaults,
  fetchLiveRealtimeDefaults,
  fetchLiveRealtimeSchema,
  patchLiveRealtimeDefaults,
} from '@/config/api'
import { buildEngineComputeTypeOptions, buildEngineDeviceOptions } from '@/config/engine-options'
import logger from '@/config/logger'
import { useAppConfig } from '@/config/use-app-config'
import { buildExportFilename } from '@/features/export'
import { useModels } from '@/features/models'
import {
  areLiveRealtimeDraftValuesEqual,
  buildLiveRealtimeDefaultsPatchPayload,
  buildLiveRealtimeRuntimeOverrides,
  clearLiveRealtimeDraftValue,
  createLiveRealtimeSessionService,
  downloadLiveSessionExport,
  isTemporaryLiveDeviceId,
  isLiveRealtimeSessionError,
  resolveLiveRealtimeEffectiveValue,
  updateLiveRealtimeDraft,
  useLiveDeviceInventory,
  useLiveRealtimeStore,
  type LiveAudioSourceKind,
  type LiveAudioDevice,
  type LiveCaptureSession,
  type LiveCaptureSlotState,
  type LiveDeviceCapabilityState,
  type LiveDeviceInventoryErrorCode,
  type LiveDeviceInventoryStatus,
  type LiveDeviceWarningCode,
  type LiveRealtimeDraft,
  type LiveRealtimeDraftValue,
  type LiveRealtimeAdapter,
  type LiveRealtimeRunState,
  type LiveRealtimeRuntimeError,
  type LiveRealtimeRuntimeErrorCode,
  type LiveRealtimeSessionStartOptions,
  type LiveRealtimeSessionService,
} from '@/features/realtime'
import { getRuntimeEnvironment } from '@/lib/runtime-environment'
import { cn } from '@/lib/utils'
import { ContentCanvas } from '@/layouts'
import {
  LIVE_WORKBENCH_DEFAULT_VIEW,
  LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW,
  resolveLiveWorkbenchView,
  type LiveWorkbenchRouteSearch,
  type LiveWorkbenchView,
} from '@/routes/live-workbench-search'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import { downloadBlob } from '@/shared/lib/utils'
import type {
  AppError,
  EngineComputeType,
  EngineDevice,
  LiveRealtimeDefaultsResponse,
  LiveRealtimeDefaultsUpdateRequest,
  LiveRealtimeOptionGroup,
} from '@/shared/types'
import {
  formatLiveWorkbenchCount,
  formatLiveWorkbenchDuration,
  formatLiveWorkbenchEmptyValue,
  formatLiveWorkbenchSessionId,
} from './live-workbench-formatters'
import {
  LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE,
  LIVE_WORKBENCH_DEFAULT_MICROPHONE_VALUE,
  LIVE_WORKBENCH_MODEL_EMPTY_VALUE,
  LIVE_WORKBENCH_MODEL_LOADING_VALUE,
  LIVE_WORKBENCH_MICROPHONE_EMPTY_VALUE,
  LIVE_WORKBENCH_MICROPHONE_LOADING_VALUE,
  LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
  hasLiveWorkbenchErrorCopy,
  selectLiveWorkbenchDisplayedAudioLevelPercent,
  resolveLiveWorkbenchInitialModelId,
  selectLiveWorkbenchCanStartSession,
  selectLiveWorkbenchCanStopSession,
  selectLiveWorkbenchErrorCopy,
  selectLiveWorkbenchIsCaptureActive,
  selectLiveWorkbenchDownloadedModels,
  selectLiveWorkbenchHasTranscript,
  selectLiveWorkbenchSelectField,
  selectLiveWorkbenchTranscriptCounts,
  selectLiveWorkbenchTranscriptItems,
} from './live-workbench-selectors'
import { LiveWorkbenchCompactView } from './LiveWorkbenchCompactView'
import {
  LiveWorkbenchSessionSetup,
  type LiveWorkbenchSourceActionMode,
  type LiveWorkbenchSourceTone,
  type LiveWorkbenchSessionSetupOption,
} from './LiveWorkbenchSessionSetup'
import { LiveWorkbenchSettingsPanel } from './LiveWorkbenchSettingsPanel'
import { LiveWorkbenchStatusBar, type LiveWorkbenchStatusItem } from './LiveWorkbenchStatusBar'
import { LiveWorkbenchTranscriptPanel } from './LiveWorkbenchTranscriptPanel'

const EMPTY_LIVE_AUDIO_DEVICES: readonly LiveAudioDevice[] = []
const EMPTY_LIVE_DEVICE_WARNINGS: readonly LiveDeviceWarningCode[] = []
const EMPTY_LIVE_REALTIME_SCHEMA: LiveRealtimeOptionGroup[] = []
const LIVE_WORKBENCH_MAIN_SETTING_KEYS: ReadonlySet<string> = new Set(['task', 'language'])
const LIVE_WORKBENCH_COMPACT_WINDOW_WIDTH = 380
const LIVE_WORKBENCH_COMPACT_WINDOW_HEIGHT = 460
const LIVE_WORKBENCH_DURATION_TICK_MS = 100

export interface LiveWorkbenchPageProps {
  search?: LiveWorkbenchRouteSearch
  updateSearch?: (patch: Partial<LiveWorkbenchRouteSearch>, replace: boolean) => void
}

interface LiveWorkbenchSourceStatus {
  i18nKey: string
  tone: LiveWorkbenchSourceTone
}

interface PreparedLiveCaptureSessions {
  sessions: Partial<Record<LiveAudioSourceKind, LiveCaptureSession>>
  ownedByStart: Partial<Record<LiveAudioSourceKind, LiveCaptureSession>>
}

interface DocumentPictureInPictureOptions {
  width?: number
  height?: number
}

interface DocumentPictureInPictureApi {
  requestWindow: (options?: DocumentPictureInPictureOptions) => Promise<Window>
}

type DocumentPictureInPictureWindow = Window & {
  documentPictureInPicture?: DocumentPictureInPictureApi
}

function getDocumentPictureInPictureApi(): DocumentPictureInPictureApi | null {
  if (typeof window === 'undefined') return null

  const api = (window as DocumentPictureInPictureWindow).documentPictureInPicture
  return typeof api?.requestWindow === 'function' ? api : null
}

function copyCompactWindowStyles(targetDocument: Document): void {
  for (const styleSheet of Array.from(document.styleSheets)) {
    try {
      const cssText = Array.from(styleSheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n')
      const style = targetDocument.createElement('style')
      style.textContent = cssText
      targetDocument.head.append(style)
    } catch {
      if (!styleSheet.href) continue

      const link = targetDocument.createElement('link')
      link.rel = 'stylesheet'
      link.href = styleSheet.href
      targetDocument.head.append(link)
    }
  }
}

function prepareCompactWindow(compactWindow: Window): void {
  const targetDocument = compactWindow.document
  targetDocument.title = document.title
  targetDocument.body.style.margin = '0'
  targetDocument.body.style.minWidth = '0'
  targetDocument.body.style.overflow = 'hidden'
  copyCompactWindowStyles(targetDocument)
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return {
    code: 'API_SERVER_UNKNOWN',
    i18nKey: 'error.api.serverError',
    retriable: true,
  }
}

function canEditLiveWorkbenchSettings(runState: LiveRealtimeRunState): boolean {
  return runState === 'idle' || runState === 'failed'
}

function canEditLiveWorkbenchSources(runState: LiveRealtimeRunState): boolean {
  return runState === 'idle' || runState === 'failed' || runState === 'finished'
}

function buildLiveWorkbenchSettingsSchema(
  schema: LiveRealtimeOptionGroup[],
): LiveRealtimeOptionGroup[] {
  return schema
    .map((group) => ({
      ...group,
      fields: group.fields.filter((field) => !LIVE_WORKBENCH_MAIN_SETTING_KEYS.has(field.key)),
    }))
    .filter((group) => group.fields.length > 0)
}

function buildLiveWorkbenchSettingsKeySet(schema: LiveRealtimeOptionGroup[]): ReadonlySet<string> {
  return new Set(schema.flatMap((group) => group.fields.map((field) => field.key)))
}

function pickLiveWorkbenchSettingsDraft(
  draft: LiveRealtimeDraft,
  settingKeys: ReadonlySet<string>,
): LiveRealtimeDraft {
  const next: LiveRealtimeDraft = {}

  for (const [key, value] of Object.entries(draft)) {
    if (settingKeys.has(key)) {
      next[key] = value
    }
  }

  return next
}

function mergeLiveWorkbenchSettingsDraft(
  current: LiveRealtimeDraft,
  settingsDraft: LiveRealtimeDraft,
  settingKeys: ReadonlySet<string>,
): LiveRealtimeDraft {
  const next: LiveRealtimeDraft = {}

  for (const [key, value] of Object.entries(current)) {
    if (!settingKeys.has(key)) {
      next[key] = value
    }
  }

  return {
    ...next,
    ...settingsDraft,
  }
}

function areLiveRealtimeDraftsEqual(left: LiveRealtimeDraft, right: LiveRealtimeDraft): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])

  for (const key of keys) {
    if (!areLiveRealtimeDraftValuesEqual(left[key], right[key])) {
      return false
    }
  }

  return true
}

function hasDeviceWarning(
  warnings: readonly LiveDeviceWarningCode[],
  warning: LiveDeviceWarningCode,
): boolean {
  return warnings.includes(warning)
}

function getCapabilityBlockStatus(
  capability: LiveDeviceCapabilityState | null,
  unsupportedKey: string,
  notImplementedKey: string,
): LiveWorkbenchSourceStatus | null {
  if (capability === 'unsupported') {
    return {
      i18nKey: unsupportedKey,
      tone: 'danger',
    }
  }

  if (capability === 'not_implemented') {
    return {
      i18nKey: notImplementedKey,
      tone: 'warning',
    }
  }

  return null
}

function getCaptureStateStatus(
  capture: LiveCaptureSlotState,
  source: 'microphone' | 'systemAudio',
): LiveWorkbenchSourceStatus | null {
  if (capture.state === 'idle') {
    return null
  }

  if (capture.state === 'starting') {
    return {
      i18nKey: `live.workbench.sessionSetup.${source}.status.starting`,
      tone: 'normal',
    }
  }

  if (capture.state === 'capturing') {
    return {
      i18nKey: `live.workbench.sessionSetup.${source}.status.capturing`,
      tone: 'success',
    }
  }

  if (capture.state === 'paused') {
    return {
      i18nKey: `live.workbench.sessionSetup.${source}.status.paused`,
      tone: 'warning',
    }
  }

  if (capture.state === 'stopping') {
    return {
      i18nKey: `live.workbench.sessionSetup.${source}.status.stopping`,
      tone: 'normal',
    }
  }

  if (capture.state === 'stopped') {
    return {
      i18nKey: `live.workbench.sessionSetup.${source}.status.stopped`,
      tone: 'muted',
    }
  }

  if (source === 'microphone' && capture.errorCode === 'microphone_permission_denied') {
    return {
      i18nKey: 'live.workbench.sessionSetup.microphone.status.permissionDenied',
      tone: 'danger',
    }
  }

  if (source === 'systemAudio' && capture.errorCode === 'system_audio_permission_denied') {
    return {
      i18nKey: 'live.workbench.sessionSetup.systemAudio.status.permissionDenied',
      tone: 'danger',
    }
  }

  if (source === 'systemAudio' && capture.errorCode === 'system_audio_track_missing') {
    return {
      i18nKey: 'live.workbench.sessionSetup.systemAudio.status.trackMissing',
      tone: 'warning',
    }
  }

  return {
    i18nKey: `live.workbench.sessionSetup.${source}.status.failed`,
    tone: 'danger',
  }
}

function getMicrophoneStatus({
  inventoryStatus,
  inventoryError,
  capability,
  warnings,
  microphoneCount,
  capture,
}: {
  inventoryStatus: LiveDeviceInventoryStatus
  inventoryError: LiveDeviceInventoryErrorCode | null
  capability: LiveDeviceCapabilityState | null
  warnings: readonly LiveDeviceWarningCode[]
  microphoneCount: number
  capture: LiveCaptureSlotState
}): LiveWorkbenchSourceStatus {
  const captureStatus = getCaptureStateStatus(capture, 'microphone')
  if (captureStatus) {
    return captureStatus
  }

  if (inventoryStatus === 'loading') {
    return {
      i18nKey: 'live.workbench.sessionSetup.microphone.status.loading',
      tone: 'muted',
    }
  }

  if (inventoryError) {
    return {
      i18nKey: 'live.workbench.sessionSetup.microphone.status.inventoryError',
      tone: 'danger',
    }
  }

  const capabilityStatus = getCapabilityBlockStatus(
    capability,
    'live.workbench.sessionSetup.microphone.status.unsupported',
    'live.workbench.sessionSetup.microphone.status.notImplemented',
  )
  if (capabilityStatus) {
    return capabilityStatus
  }

  if (hasDeviceWarning(warnings, 'microphone_permission_denied')) {
    return {
      i18nKey: 'live.workbench.sessionSetup.microphone.status.permissionDenied',
      tone: 'danger',
    }
  }

  if (hasDeviceWarning(warnings, 'microphone_permission_required')) {
    return {
      i18nKey: 'live.workbench.sessionSetup.microphone.status.permissionRequired',
      tone: 'warning',
    }
  }

  if (microphoneCount === 0) {
    return {
      i18nKey: 'live.workbench.sessionSetup.microphone.status.noDevice',
      tone: 'warning',
    }
  }

  return {
    i18nKey: 'live.workbench.sessionSetup.microphone.status.ready',
    tone: 'success',
  }
}

function getSystemAudioStatus({
  inventoryStatus,
  inventoryError,
  capability,
  capture,
}: {
  inventoryStatus: LiveDeviceInventoryStatus
  inventoryError: LiveDeviceInventoryErrorCode | null
  capability: LiveDeviceCapabilityState | null
  capture: LiveCaptureSlotState
}): LiveWorkbenchSourceStatus {
  const captureStatus = getCaptureStateStatus(capture, 'systemAudio')
  if (captureStatus) {
    return captureStatus
  }

  if (inventoryStatus === 'loading') {
    return {
      i18nKey: 'live.workbench.sessionSetup.systemAudio.status.loading',
      tone: 'muted',
    }
  }

  if (inventoryError) {
    return {
      i18nKey: 'live.workbench.sessionSetup.systemAudio.status.inventoryError',
      tone: 'danger',
    }
  }

  const capabilityStatus = getCapabilityBlockStatus(
    capability,
    'live.workbench.sessionSetup.systemAudio.status.unsupported',
    'live.workbench.sessionSetup.systemAudio.status.notImplemented',
  )
  if (capabilityStatus) {
    return capabilityStatus
  }

  if (capability === 'limited') {
    return {
      i18nKey: 'live.workbench.sessionSetup.systemAudio.status.limited',
      tone: 'warning',
    }
  }

  return {
    i18nKey: 'live.workbench.sessionSetup.systemAudio.status.ready',
    tone: 'success',
  }
}

function buildMicrophoneOption(
  device: LiveAudioDevice,
  index: number,
  t: (key: string, options?: { index: number }) => string,
): LiveWorkbenchSessionSetupOption {
  return {
    value: device.id,
    label: device.label ?? t('live.workbench.sessionSetup.microphone.fallbackDevice', { index }),
    disabled: device.isTemporary,
  }
}

function buildEngineSetupOption<TValue extends EngineDevice | EngineComputeType>(
  option: { value: TValue; labelKey: string | null },
  t: (key: string) => string,
): LiveWorkbenchSessionSetupOption {
  return {
    value: option.value,
    label: option.labelKey ? t(option.labelKey) : option.value,
  }
}

function canStartMicrophoneCapture({
  enabled,
  capability,
  microphoneCount,
}: {
  enabled: boolean
  capability: LiveDeviceCapabilityState | null
  microphoneCount: number
}): boolean {
  return enabled && capability === 'available' && microphoneCount > 0
}

function canStartSystemAudioCapture({
  enabled,
  capability,
}: {
  enabled: boolean
  capability: LiveDeviceCapabilityState | null
}): boolean {
  return enabled && (capability === 'available' || capability === 'limited')
}

function isLiveWorkbenchSessionBusy(runState: LiveRealtimeRunState): boolean {
  return runState === 'starting' || runState === 'active' || runState === 'finishing'
}

function buildLiveWorkbenchRuntimeError(
  code: LiveRealtimeRuntimeErrorCode,
): LiveRealtimeRuntimeError {
  return {
    code,
    message: code,
    retryable: false,
  }
}

function formatLiveRealtimeAdapter(
  adapter: LiveRealtimeAdapter | string | null | undefined,
  t: (key: string) => string,
  emptyValue: string,
): string {
  if (adapter === 'mock') return t('live.workbench.runtime.mock')
  if (adapter === 'whisper_streaming') return t('live.workbench.runtime.whisperStreaming')
  return adapter || emptyValue
}

function resolveLiveRealtimeSchemaAdapter(
  adapter: LiveRealtimeAdapter | string | null | undefined,
): LiveRealtimeAdapter {
  return adapter === 'whisper_streaming' ? 'whisper_streaming' : 'mock'
}

function resolveLiveWorkbenchStartButtonKey(runState: LiveRealtimeRunState): string {
  if (runState === 'starting') return 'live.workbench.actions.starting'
  if (runState === 'finishing') return 'live.workbench.actions.stopping'
  if (runState === 'active') return 'live.workbench.actions.stop'
  return 'live.workbench.actions.start'
}

function normalizeLiveWorkbenchCaughtError(
  error: unknown,
  fallbackCode: LiveRealtimeRuntimeErrorCode,
): LiveRealtimeRuntimeError {
  if (isLiveRealtimeSessionError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    }
  }

  if (isAppError(error) && hasLiveWorkbenchErrorCopy(error.code)) {
    const detail =
      error.params && typeof error.params.detail === 'string' ? error.params.detail : error.code
    return {
      code: error.code,
      message: detail,
      retryable: error.retriable,
    }
  }

  const storeError = useLiveRealtimeStore.getState().lastError
  if (storeError) return storeError

  return buildLiveWorkbenchRuntimeError(fallbackCode)
}

export function LiveWorkbenchPage({ search, updateSearch }: LiveWorkbenchPageProps = {}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const sessionServiceRef = useRef<LiveRealtimeSessionService | null>(null)
  const { config, isLoading: isConfigLoading } = useAppConfig()
  const liveRunState = useLiveRealtimeStore((state) => state.runState)
  const liveSession = useLiveRealtimeStore((state) => state.session)
  const liveConnectionState = useLiveRealtimeStore((state) => state.connectionState)
  const liveTracksBySource = useLiveRealtimeStore((state) => state.tracksBySource)
  const livePreviewsByTrackId = useLiveRealtimeStore((state) => state.currentPreviewsByTrackId)
  const liveCommittedPartialsByTrackId = useLiveRealtimeStore(
    (state) => state.latestCommittedPartialsByTrackId,
  )
  const liveFinalTranscripts = useLiveRealtimeStore((state) => state.finalTranscripts)
  const liveLastError = useLiveRealtimeStore((state) => state.lastError)
  const { models, configuredModelId, lastLoadedModelId, isLoading: isModelsLoading } = useModels()
  const defaultsQuery = useQuery({
    queryKey: queryKeys.config.liveRealtimeDefaults(),
    queryFn: ({ signal }) => fetchLiveRealtimeDefaults(signal),
  })
  const schemaQuery = useQuery({
    queryKey: queryKeys.config.liveRealtimeSchema(),
    queryFn: ({ signal }) => fetchLiveRealtimeSchema(signal),
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState<LiveRealtimeDraft>({})
  const [settingsDraft, setSettingsDraft] = useState<LiveRealtimeDraft>({})
  const [selectedModelOverrideId, setSelectedModelOverrideId] = useState<string | null>(null)
  const [selectedEngineDeviceOverride, setSelectedEngineDeviceOverride] =
    useState<EngineDevice | null>(null)
  const [selectedEngineComputeTypeOverride, setSelectedEngineComputeTypeOverride] =
    useState<EngineComputeType | null>(null)
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false)
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false)
  const [systemAudioTestSessionId, setSystemAudioTestSessionId] = useState<string | null>(null)
  const [sessionPreparing, setSessionPreparing] = useState(false)
  const [compactOpen, setCompactOpen] = useState(false)
  const [compactWindow, setCompactWindow] = useState<Window | null>(null)
  const [exportDownloading, setExportDownloading] = useState(false)
  const [fallbackView, setFallbackView] = useState<LiveWorkbenchView>(LIVE_WORKBENCH_DEFAULT_VIEW)
  const [durationNowMs, setDurationNowMs] = useState(() => Date.now())
  const compactWindowRef = useRef<Window | null>(null)
  const compactWindowPagehideListenerRef = useRef<EventListener | null>(null)
  const exportDownloadingRef = useRef(false)
  const liveDevices = useLiveDeviceInventory()
  const emptyValue = formatLiveWorkbenchEmptyValue()
  const liveRuntimeAdapter = config?.live_realtime?.runtime_adapter ?? null
  const supportsSessionRuntimeOverrides =
    liveRuntimeAdapter === 'whisper_streaming' &&
    config?.live_realtime?.supports_runtime_overrides === true
  const liveWorkbenchView = search ? resolveLiveWorkbenchView(search) : fallbackView
  const transcriptExpanded = liveWorkbenchView === LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW

  function detachCompactWindowPagehideListener(activeCompactWindow: Window): void {
    const pagehideListener = compactWindowPagehideListenerRef.current
    if (!pagehideListener) return

    activeCompactWindow.removeEventListener('pagehide', pagehideListener)
    compactWindowPagehideListenerRef.current = null
  }

  useEffect(() => {
    return () => {
      const service = sessionServiceRef.current
      if (!service || service.state === 'idle' || service.state === 'finished') return

      void service.stop().catch((error: unknown) => {
        logger.warn('live.workbench.session.cleanupFailed', { error })
      })
    }
  }, [])

  useEffect(() => {
    return () => {
      const activeCompactWindow = compactWindowRef.current
      compactWindowRef.current = null

      if (activeCompactWindow && !activeCompactWindow.closed) {
        detachCompactWindowPagehideListener(activeCompactWindow)
        activeCompactWindow.close()
      }
    }
  }, [])

  useEffect(() => {
    if (!isLiveWorkbenchSessionBusy(liveRunState)) return undefined

    const intervalId = window.setInterval(() => {
      setDurationNowMs(Date.now())
    }, LIVE_WORKBENCH_DURATION_TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [liveRunState])

  const defaults = defaultsQuery.data?.defaults ?? null
  const schema = schemaQuery.data?.schema ?? EMPTY_LIVE_REALTIME_SCHEMA
  const settingsSchema = useMemo(() => buildLiveWorkbenchSettingsSchema(schema), [schema])
  const settingsFieldKeys = useMemo(
    () => buildLiveWorkbenchSettingsKeySet(settingsSchema),
    [settingsSchema],
  )
  const hasDefaults = defaults !== null
  const settingsEditable = !sessionPreparing && canEditLiveWorkbenchSettings(liveRunState)
  const settingsDraftHasChanges = Object.keys(settingsDraft).length > 0
  const settingsDraftMatchesSession = areLiveRealtimeDraftsEqual(
    settingsDraft,
    pickLiveWorkbenchSettingsDraft(draft, settingsFieldKeys),
  )
  const saveDefaultsMutation = useMutation({
    mutationFn: (payload: LiveRealtimeDefaultsUpdateRequest) => patchLiveRealtimeDefaults(payload),
    onSuccess: (response) => {
      queryClient.setQueryData<LiveRealtimeDefaultsResponse>(
        queryKeys.config.liveRealtimeDefaults(),
        { defaults: response.defaults },
      )
      void queryClient
        .invalidateQueries({ queryKey: queryKeys.config.liveRealtimeDefaults() })
        .catch((error: unknown) => {
          logger.warn('live.workbench.settings.refreshDefaultsFailed', { error })
          toast.warning(t('live.workbench.settings.toast.refreshWarning'))
        })
      setDraft((current) => mergeLiveWorkbenchSettingsDraft(current, {}, settingsFieldKeys))
      setSettingsDraft({})
      toast.success(t('live.workbench.settings.toast.defaultsSaved'))
    },
    onError: (error) => {
      logger.error('live.workbench.settings.saveDefaultsFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    },
  })
  const resetDefaultsMutation = useMutation({
    mutationFn: async () => {
      await deleteLiveRealtimeDefaults()
      return fetchLiveRealtimeDefaults()
    },
    onSuccess: (response) => {
      queryClient.setQueryData<LiveRealtimeDefaultsResponse>(
        queryKeys.config.liveRealtimeDefaults(),
        response,
      )
      void queryClient
        .invalidateQueries({ queryKey: queryKeys.config.liveRealtimeDefaults() })
        .catch((error: unknown) => {
          logger.warn('live.workbench.settings.refreshDefaultsFailed', { error })
          toast.warning(t('live.workbench.settings.toast.refreshWarning'))
        })
      setDraft((current) => mergeLiveWorkbenchSettingsDraft(current, {}, settingsFieldKeys))
      setSettingsDraft({})
      toast.success(t('live.workbench.settings.toast.defaultsReset'))
    },
    onError: (error) => {
      logger.error('live.workbench.settings.resetDefaultsFailed', { error })
      const appError = toAppError(error)
      toast.error(t(appError.i18nKey, appError.params ?? {}))
    },
  })
  const settingsMutationPending = saveDefaultsMutation.isPending || resetDefaultsMutation.isPending
  const settingsControlsDisabled =
    !settingsEditable || defaultsQuery.isPending || schemaQuery.isPending || settingsMutationPending
  const downloadedModels = useMemo(() => selectLiveWorkbenchDownloadedModels(models), [models])
  const downloadedModelIds = useMemo(
    () => new Set(downloadedModels.map((model) => model.model_id)),
    [downloadedModels],
  )
  const initialModelId = useMemo(
    () =>
      resolveLiveWorkbenchInitialModelId({
        configuredModelId,
        lastLoadedModelId,
        downloadedModels,
      }),
    [configuredModelId, downloadedModels, lastLoadedModelId],
  )
  const selectedModelId =
    selectedModelOverrideId && downloadedModelIds.has(selectedModelOverrideId)
      ? selectedModelOverrideId
      : initialModelId
  const configuredModelUnavailable = Boolean(
    configuredModelId && !downloadedModelIds.has(configuredModelId),
  )
  const modelOptions = useMemo<LiveWorkbenchSessionSetupOption[]>(() => {
    if (isModelsLoading) {
      return [
        {
          value: LIVE_WORKBENCH_MODEL_LOADING_VALUE,
          label: t('live.workbench.sessionSetup.model.loading'),
          disabled: true,
        },
      ]
    }

    if (downloadedModels.length === 0) {
      return [
        {
          value: LIVE_WORKBENCH_MODEL_EMPTY_VALUE,
          label: t('live.workbench.sessionSetup.model.noDownloaded'),
          disabled: true,
        },
      ]
    }

    const downloadedOptions = downloadedModels.map((model) => ({
      value: model.model_id,
      label: model.name,
    }))

    return downloadedOptions
  }, [downloadedModels, isModelsLoading, t])
  const modelValue =
    selectedModelId && downloadedModelIds.has(selectedModelId)
      ? selectedModelId
      : isModelsLoading
        ? LIVE_WORKBENCH_MODEL_LOADING_VALUE
        : LIVE_WORKBENCH_MODEL_EMPTY_VALUE
  const taskField = selectLiveWorkbenchSelectField(schema, 'task')
  const resolvedTask = defaults
    ? resolveLiveRealtimeEffectiveValue(defaults, draft, 'task')
    : undefined
  const taskOptions = useMemo<LiveWorkbenchSessionSetupOption[]>(() => {
    if (schemaQuery.isPending) {
      return [
        {
          value: LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
          label: t('live.workbench.sessionSetup.loading'),
          disabled: true,
        },
      ]
    }

    if (!taskField) {
      return [
        {
          value: LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
          label: t('live.workbench.sessionSetup.unavailable'),
          disabled: true,
        },
      ]
    }

    const options = taskField.options ?? []
    if (options.length === 0) {
      return [
        {
          value: LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
          label: t('live.workbench.sessionSetup.unavailable'),
          disabled: true,
        },
      ]
    }

    const setupOptions: LiveWorkbenchSessionSetupOption[] = options.map((option) => ({
      value: option.value,
      label: t(option.label_key),
    }))
    if (
      typeof resolvedTask === 'string' &&
      !setupOptions.some((option) => option.value === resolvedTask)
    ) {
      setupOptions.push({
        value: resolvedTask,
        label: resolvedTask,
        disabled: true,
      })
    }

    return setupOptions
  }, [resolvedTask, schemaQuery.isPending, t, taskField])
  const taskOptionValues = useMemo(
    () => new Set(taskOptions.filter((option) => !option.disabled).map((option) => option.value)),
    [taskOptions],
  )
  const taskOptionDisplayValues = useMemo(
    () => new Set(taskOptions.map((option) => option.value)),
    [taskOptions],
  )
  const taskValue =
    typeof resolvedTask === 'string' && taskOptionDisplayValues.has(resolvedTask)
      ? resolvedTask
      : (taskOptions[0]?.value ?? LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE)
  const languageField = selectLiveWorkbenchSelectField(schema, 'language')
  const resolvedLanguage = defaults
    ? resolveLiveRealtimeEffectiveValue(defaults, draft, 'language')
    : undefined
  const languageOptions = useMemo<LiveWorkbenchSessionSetupOption[]>(() => {
    if (schemaQuery.isPending || isConfigLoading) {
      return [
        {
          value: LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
          label: t('live.workbench.sessionSetup.loading'),
          disabled: true,
        },
      ]
    }

    if (!languageField) {
      return [
        {
          value: LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
          label: t('live.workbench.sessionSetup.unavailable'),
          disabled: true,
        },
      ]
    }

    const options: LiveWorkbenchSessionSetupOption[] =
      languageField.options_source === 'effective_languages'
        ? [
            {
              value: LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE,
              label: t('live.workbench.sessionSetup.language.auto'),
            },
            ...(config?.effective_languages ?? []).map((option) => ({
              value: option.code,
              label: t(option.label_key),
            })),
          ]
        : (languageField.options?.map((option) => ({
            value: option.value,
            label: t(option.label_key),
          })) ?? [])

    if (options.length === 0) {
      return [
        {
          value: LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
          label: t('live.workbench.sessionSetup.unavailable'),
          disabled: true,
        },
      ]
    }

    if (
      typeof resolvedLanguage === 'string' &&
      !options.some((option) => option.value === resolvedLanguage)
    ) {
      options.push({
        value: resolvedLanguage,
        label: resolvedLanguage,
        disabled: true,
      })
    }

    return options
  }, [
    config?.effective_languages,
    isConfigLoading,
    languageField,
    resolvedLanguage,
    schemaQuery.isPending,
    t,
  ])
  const languageOptionValues = useMemo(
    () =>
      new Set(languageOptions.filter((option) => !option.disabled).map((option) => option.value)),
    [languageOptions],
  )
  const languageOptionDisplayValues = useMemo(
    () => new Set(languageOptions.map((option) => option.value)),
    [languageOptions],
  )
  const languageValue =
    typeof resolvedLanguage === 'string' && languageOptionDisplayValues.has(resolvedLanguage)
      ? resolvedLanguage
      : schemaQuery.isPending || isConfigLoading
        ? LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE
        : LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE
  const engineDeviceOptions = useMemo<LiveWorkbenchSessionSetupOption[]>(() => {
    const options = buildEngineDeviceOptions(
      config?.engine.schema ?? [],
      config?.engine.device ?? null,
    )

    if (options.length === 0) {
      return [
        {
          value: LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
          label: t('live.workbench.sessionSetup.unavailable'),
          disabled: true,
        },
      ]
    }

    return options.map((option) => buildEngineSetupOption(option, t))
  }, [config?.engine.device, config?.engine.schema, t])
  const engineDeviceOptionValues = useMemo(
    () =>
      new Set(
        engineDeviceOptions.filter((option) => !option.disabled).map((option) => option.value),
      ),
    [engineDeviceOptions],
  )
  const selectedEngineDevice = supportsSessionRuntimeOverrides
    ? (selectedEngineDeviceOverride ?? config?.engine.device ?? null)
    : (config?.engine.device ?? null)
  const engineDeviceValue =
    selectedEngineDevice && engineDeviceOptionValues.has(selectedEngineDevice)
      ? selectedEngineDevice
      : LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE
  const engineComputeTypeOptions = useMemo<LiveWorkbenchSessionSetupOption[]>(() => {
    const options = buildEngineComputeTypeOptions(
      config?.engine.schema ?? [],
      config?.engine.compute_type ?? null,
    )

    if (options.length === 0) {
      return [
        {
          value: LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
          label: t('live.workbench.sessionSetup.unavailable'),
          disabled: true,
        },
      ]
    }

    return options.map((option) => buildEngineSetupOption(option, t))
  }, [config?.engine.compute_type, config?.engine.schema, t])
  const engineComputeTypeOptionValues = useMemo(
    () =>
      new Set(
        engineComputeTypeOptions.filter((option) => !option.disabled).map((option) => option.value),
      ),
    [engineComputeTypeOptions],
  )
  const selectedEngineComputeType = supportsSessionRuntimeOverrides
    ? (selectedEngineComputeTypeOverride ?? config?.engine.compute_type ?? null)
    : (config?.engine.compute_type ?? null)
  const engineComputeTypeValue =
    selectedEngineComputeType && engineComputeTypeOptionValues.has(selectedEngineComputeType)
      ? selectedEngineComputeType
      : LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE
  const runtimeSummary = formatLiveRealtimeAdapter(liveRuntimeAdapter, t, emptyValue)
  const inventory = liveDevices.inventory
  const deviceWarnings = inventory?.warnings ?? EMPTY_LIVE_DEVICE_WARNINGS
  const microphoneCapability = inventory?.capabilities.microphoneCapture ?? null
  const systemAudioCapability = inventory?.capabilities.systemAudioCapture ?? null
  const microphoneDevices = inventory?.microphones ?? EMPTY_LIVE_AUDIO_DEVICES
  const microphoneCaptureActive = selectLiveWorkbenchIsCaptureActive(
    liveDevices.microphoneCapture.state,
  )
  const systemAudioCaptureActive = selectLiveWorkbenchIsCaptureActive(
    liveDevices.systemAudioCapture.state,
  )
  const systemAudioTestVisible =
    systemAudioCaptureActive &&
    systemAudioTestSessionId !== null &&
    systemAudioTestSessionId === liveDevices.systemAudioCapture.sessionId
  const sessionAudioLevelVisible = sessionPreparing || isLiveWorkbenchSessionBusy(liveRunState)
  const microphoneOptions = useMemo<LiveWorkbenchSessionSetupOption[]>(() => {
    if (liveDevices.inventoryStatus === 'loading') {
      return [
        {
          value: LIVE_WORKBENCH_MICROPHONE_LOADING_VALUE,
          label: t('live.workbench.sessionSetup.microphone.loading'),
          disabled: true,
        },
      ]
    }

    if (
      liveDevices.inventoryError ||
      microphoneCapability === 'unsupported' ||
      microphoneCapability === 'not_implemented' ||
      microphoneDevices.length === 0
    ) {
      return [
        {
          value: LIVE_WORKBENCH_MICROPHONE_EMPTY_VALUE,
          label: t('live.workbench.sessionSetup.microphone.noDevice'),
          disabled: true,
        },
      ]
    }

    return [
      {
        value: LIVE_WORKBENCH_DEFAULT_MICROPHONE_VALUE,
        label: t('live.workbench.sessionSetup.microphone.defaultDevice'),
      },
      ...microphoneDevices.map((device, index) => buildMicrophoneOption(device, index + 1, t)),
    ]
  }, [
    liveDevices.inventoryError,
    liveDevices.inventoryStatus,
    microphoneCapability,
    microphoneDevices,
    t,
  ])
  const microphoneOptionValues = useMemo(
    () =>
      new Set(microphoneOptions.filter((option) => !option.disabled).map((option) => option.value)),
    [microphoneOptions],
  )
  const microphoneValue =
    liveDevices.selectedMicrophoneId &&
    microphoneOptionValues.has(liveDevices.selectedMicrophoneId) &&
    !isTemporaryLiveDeviceId(liveDevices.selectedMicrophoneId)
      ? liveDevices.selectedMicrophoneId
      : microphoneOptionValues.has(LIVE_WORKBENCH_DEFAULT_MICROPHONE_VALUE)
        ? LIVE_WORKBENCH_DEFAULT_MICROPHONE_VALUE
        : (microphoneOptions[0]?.value ?? LIVE_WORKBENCH_MICROPHONE_EMPTY_VALUE)
  const microphoneStatus = getMicrophoneStatus({
    inventoryStatus: liveDevices.inventoryStatus,
    inventoryError: liveDevices.inventoryError,
    capability: microphoneCapability,
    warnings: deviceWarnings,
    microphoneCount: microphoneDevices.length,
    capture: liveDevices.microphoneCapture,
  })
  const systemAudioStatus = getSystemAudioStatus({
    inventoryStatus: liveDevices.inventoryStatus,
    inventoryError: liveDevices.inventoryError,
    capability: systemAudioCapability,
    capture: liveDevices.systemAudioCapture,
  })
  const microphoneActionMode: LiveWorkbenchSourceActionMode = microphoneCaptureActive
    ? 'stop'
    : 'test'
  const systemAudioCaptureSourceActionMode: LiveWorkbenchSourceActionMode = systemAudioCaptureActive
    ? 'stop'
    : 'start'
  const systemAudioTestActionMode: LiveWorkbenchSourceActionMode = systemAudioTestVisible
    ? 'stop'
    : 'test'
  const sourceControlsDisabled = sessionPreparing || !canEditLiveWorkbenchSources(liveRunState)
  const microphoneBusy =
    liveDevices.microphoneCapture.state === 'starting' ||
    liveDevices.microphoneCapture.state === 'stopping'
  const systemAudioBusy =
    liveDevices.systemAudioCapture.state === 'starting' ||
    liveDevices.systemAudioCapture.state === 'stopping'
  const microphoneDisabled =
    sourceControlsDisabled ||
    liveDevices.inventoryStatus === 'loading' ||
    microphoneCapability === 'unsupported' ||
    microphoneCapability === 'not_implemented' ||
    microphoneDevices.length === 0 ||
    Boolean(liveDevices.inventoryError)
  const systemAudioDisabled =
    sourceControlsDisabled ||
    liveDevices.inventoryStatus === 'loading' ||
    systemAudioCapability === 'unsupported' ||
    systemAudioCapability === 'not_implemented' ||
    Boolean(liveDevices.inventoryError)
  const microphoneActionDisabled =
    sourceControlsDisabled ||
    microphoneBusy ||
    (!microphoneCaptureActive &&
      !canStartMicrophoneCapture({
        enabled: microphoneEnabled,
        capability: microphoneCapability,
        microphoneCount: microphoneDevices.length,
      }))
  const systemAudioCaptureSourceActionDisabled =
    sourceControlsDisabled ||
    systemAudioBusy ||
    (!systemAudioCaptureActive &&
      !canStartSystemAudioCapture({
        enabled: systemAudioEnabled,
        capability: systemAudioCapability,
      }))
  const systemAudioTestActionDisabled =
    sourceControlsDisabled ||
    systemAudioBusy ||
    !systemAudioCaptureActive ||
    !liveDevices.systemAudioCapture.sessionId
  const selectedSources = useMemo<LiveAudioSourceKind[]>(() => {
    const sources: LiveAudioSourceKind[] = []
    if (microphoneEnabled) sources.push('microphone')
    if (systemAudioEnabled) sources.push('system')
    return sources
  }, [microphoneEnabled, systemAudioEnabled])
  const transcriptCounts = useMemo(
    () =>
      selectLiveWorkbenchTranscriptCounts({
        finalTranscripts: liveFinalTranscripts,
        committedPartials: liveCommittedPartialsByTrackId,
        previews: livePreviewsByTrackId,
      }),
    [liveCommittedPartialsByTrackId, liveFinalTranscripts, livePreviewsByTrackId],
  )
  const transcriptItems = useMemo(
    () =>
      selectLiveWorkbenchTranscriptItems({
        finalTranscripts: liveFinalTranscripts,
        committedPartials: liveCommittedPartialsByTrackId,
        previews: livePreviewsByTrackId,
      }),
    [liveCommittedPartialsByTrackId, liveFinalTranscripts, livePreviewsByTrackId],
  )
  const hasTranscript = selectLiveWorkbenchHasTranscript(transcriptCounts)
  const errorCopy = selectLiveWorkbenchErrorCopy(liveLastError)
  const sessionStatusLabel = sessionPreparing
    ? t('live.workbench.statusBar.runState.preparing')
    : t(`live.workbench.statusBar.runState.${liveRunState}`)
  const connectionStatusLabel = t(`live.workbench.statusBar.connectionState.${liveConnectionState}`)
  const durationLabel = formatLiveWorkbenchDuration(
    liveSession?.started_at,
    liveSession?.ended_at,
    durationNowMs,
    emptyValue,
  )
  const activeTrackCount = Object.keys(liveTracksBySource).length
  const startButtonDisabled =
    sessionPreparing ||
    !selectLiveWorkbenchCanStartSession(liveRunState) ||
    isModelsLoading ||
    defaultsQuery.isPending ||
    schemaQuery.isPending
  const stopButtonDisabled = !selectLiveWorkbenchCanStopSession(liveRunState)
  const canDownloadTranscript =
    liveRunState === 'finished' &&
    Boolean(liveSession?.session_id) &&
    transcriptCounts.finalCount > 0
  const downloadTranscriptDisabled = !canDownloadTranscript || exportDownloading
  const sessionActionLabel = sessionPreparing
    ? t('live.workbench.actions.preparing')
    : t(resolveLiveWorkbenchStartButtonKey(liveRunState))
  const statusItems: readonly LiveWorkbenchStatusItem[] = [
    {
      id: 'status',
      label: t('live.workbench.statusBar.status'),
      value: sessionStatusLabel,
    },
    {
      id: 'session',
      label: t('live.workbench.statusBar.session'),
      value: formatLiveWorkbenchSessionId(liveSession?.session_id, emptyValue),
    },
    {
      id: 'duration',
      label: t('live.workbench.statusBar.duration'),
      value: durationLabel,
    },
    {
      id: 'connection',
      label: t('live.workbench.statusBar.connection'),
      value: connectionStatusLabel,
    },
    {
      id: 'tracks',
      label: t('live.workbench.statusBar.tracks'),
      value: formatLiveWorkbenchCount(activeTrackCount),
    },
    {
      id: 'runtime',
      label: t('live.workbench.statusBar.runtime'),
      value: liveSession
        ? formatLiveRealtimeAdapter(liveSession.runtime, t, emptyValue)
        : runtimeSummary,
    },
  ]
  const transcriptEmptyTitle =
    downloadedModels.length === 0 && !isModelsLoading
      ? t('live.workbench.transcript.empty.noModelTitle')
      : configuredModelUnavailable
        ? t('live.workbench.transcript.empty.configuredModelUnavailableTitle')
        : t('live.workbench.transcript.empty.title')
  const transcriptEmptyDescription =
    downloadedModels.length === 0 && !isModelsLoading
      ? t('live.workbench.transcript.empty.noModelDescription')
      : configuredModelUnavailable
        ? t('live.workbench.transcript.empty.configuredModelUnavailableDescription')
        : t('live.workbench.transcript.empty.description')

  function handleModelChange(value: string): void {
    if (downloadedModelIds.has(value)) {
      setSelectedModelOverrideId(value)
    }
  }

  function handleTaskChange(value: string): void {
    if (!defaults || !supportsSessionRuntimeOverrides || !taskOptionValues.has(value)) return

    setDraft((current) => updateLiveRealtimeDraft(current, defaults, 'task', value))
  }

  function handleLanguageChange(value: string): void {
    if (!defaults || !supportsSessionRuntimeOverrides || !languageOptionValues.has(value)) return

    const nextValue = value === LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE ? null : value
    setDraft((current) => updateLiveRealtimeDraft(current, defaults, 'language', nextValue))
  }

  function handleEngineDeviceChange(value: string): void {
    if (!supportsSessionRuntimeOverrides || !engineDeviceOptionValues.has(value)) return

    setSelectedEngineDeviceOverride(value as EngineDevice)
  }

  function handleEngineComputeTypeChange(value: string): void {
    if (!supportsSessionRuntimeOverrides || !engineComputeTypeOptionValues.has(value)) return

    setSelectedEngineComputeTypeOverride(value as EngineComputeType)
  }

  function handleMicrophoneEnabledChange(enabled: boolean): void {
    setMicrophoneEnabled(enabled)
    if (!enabled && microphoneCaptureActive) {
      runLiveDeviceAction(
        liveDevices.stopMicrophoneCapture(),
        'stop microphone capture after source disable',
      )
    }
  }

  function handleMicrophoneChange(value: string): void {
    if (!microphoneOptionValues.has(value)) return

    const selectedDeviceId =
      value === LIVE_WORKBENCH_DEFAULT_MICROPHONE_VALUE || isTemporaryLiveDeviceId(value)
        ? null
        : value

    if (microphoneBusy) return

    if (microphoneCaptureActive) {
      runLiveDeviceAction(
        restartMicrophoneCapture(selectedDeviceId),
        'restart microphone test capture after device change',
      )
      return
    }

    liveDevices.selectMicrophone(selectedDeviceId)
  }

  async function restartMicrophoneCapture(deviceId: string | null): Promise<void> {
    await liveDevices.stopMicrophoneCapture()
    liveDevices.selectMicrophone(deviceId)
    await liveDevices.startMicrophoneCapture({ deviceId })
  }

  function handleMicrophoneAction(): void {
    if (microphoneCaptureActive) {
      runLiveDeviceAction(liveDevices.stopMicrophoneCapture(), 'stop microphone test capture')
      return
    }

    runLiveDeviceAction(
      liveDevices.startMicrophoneCapture({
        deviceId: liveDevices.selectedMicrophoneId,
      }),
      'start microphone test capture',
    )
  }

  function handleSystemAudioEnabledChange(enabled: boolean): void {
    setSystemAudioEnabled(enabled)
    if (!enabled && systemAudioCaptureActive) {
      setSystemAudioTestSessionId(null)
      runLiveDeviceAction(
        liveDevices.stopSystemAudioCapture(),
        'stop system audio capture after source disable',
      )
    }
  }

  function handleSystemAudioCaptureSourceAction(): void {
    if (systemAudioCaptureActive) {
      setSystemAudioTestSessionId(null)
      runLiveDeviceAction(liveDevices.stopSystemAudioCapture(), 'stop system audio capture')
      return
    }

    runLiveDeviceAction(liveDevices.startSystemAudioCapture(), 'start system audio capture')
  }

  function handleSystemAudioTestAction(): void {
    const sessionId = liveDevices.systemAudioCapture.sessionId
    if (!systemAudioCaptureActive || !sessionId) return

    setSystemAudioTestSessionId((current) => (current === sessionId ? null : sessionId))
  }

  function setLiveWorkbenchView(view: LiveWorkbenchView, replace: boolean): void {
    if (updateSearch) {
      updateSearch(
        view === LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW
          ? { view: LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW }
          : { view: undefined },
        replace,
      )
      return
    }

    setFallbackView(view)
  }

  function setActiveCompactWindow(nextWindow: Window | null): void {
    compactWindowRef.current = nextWindow
    setCompactWindow(nextWindow)
  }

  function closeActiveCompactWindow(): void {
    const activeCompactWindow = compactWindowRef.current
    setActiveCompactWindow(null)

    if (activeCompactWindow && !activeCompactWindow.closed) {
      detachCompactWindowPagehideListener(activeCompactWindow)
      activeCompactWindow.close()
    }
  }

  function handleTranscriptFocusToggle(): void {
    setLiveWorkbenchView(
      transcriptExpanded ? LIVE_WORKBENCH_DEFAULT_VIEW : LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW,
      false,
    )
  }

  function handleCompactOpenChange(open: boolean): void {
    setCompactOpen(open)
    if (!open) {
      closeActiveCompactWindow()
    }
  }

  function handleCompactExpand(): void {
    setLiveWorkbenchView(LIVE_WORKBENCH_TRANSCRIPT_FOCUS_VIEW, false)
    closeActiveCompactWindow()
    setCompactOpen(false)
  }

  function handleCompactWindowClosed(): void {
    compactWindowPagehideListenerRef.current = null
    setActiveCompactWindow(null)
    setCompactOpen(false)
  }

  async function handleOpenCompactView(): Promise<void> {
    const runtimeEnvironment = getRuntimeEnvironment()

    if (runtimeEnvironment === 'tauri') {
      toast.warning(t('live.workbench.compact.desktopUnavailable.title'), {
        description: t('live.workbench.compact.desktopUnavailable.description'),
      })
      return
    }

    const documentPictureInPicture = getDocumentPictureInPictureApi()
    if (!documentPictureInPicture) {
      toast.warning(t('live.workbench.compact.unsupported.title'), {
        description: t('live.workbench.compact.unsupported.description'),
      })
      return
    }

    const activeCompactWindow = compactWindowRef.current
    if (activeCompactWindow && !activeCompactWindow.closed) {
      activeCompactWindow.focus()
      setCompactOpen(true)
      return
    }

    try {
      const nextWindow = await documentPictureInPicture.requestWindow({
        width: LIVE_WORKBENCH_COMPACT_WINDOW_WIDTH,
        height: LIVE_WORKBENCH_COMPACT_WINDOW_HEIGHT,
      })
      prepareCompactWindow(nextWindow)
      const pagehideListener: EventListener = () => handleCompactWindowClosed()
      compactWindowPagehideListenerRef.current = pagehideListener
      nextWindow.addEventListener('pagehide', pagehideListener, { once: true })
      setActiveCompactWindow(nextWindow)
      setCompactOpen(true)
    } catch (error) {
      logger.warn('live.workbench.compact.openFailed', { error })
      toast.error(t('live.workbench.compact.openFailed.title'), {
        description: t('live.workbench.compact.openFailed.description'),
      })
    }
  }

  async function handleDownloadTranscript(): Promise<void> {
    if (!liveSession?.session_id || !canDownloadTranscript || exportDownloadingRef.current) {
      return
    }

    exportDownloadingRef.current = true
    setExportDownloading(true)
    try {
      const { blob, filename } = await downloadLiveSessionExport(liveSession.session_id)
      const fallbackFilename = buildExportFilename({
        fallbackId: liveSession.session_id,
        format: 'srt',
        sourceName: liveSession.title,
      })
      downloadBlob(blob, filename || fallbackFilename)
      toast.success(t('live.workbench.transcript.download.toast.success'))
    } catch (error: unknown) {
      logger.error('live.workbench.downloadTranscriptFailed', {
        error,
        sessionId: liveSession.session_id,
      })
      toast.error(t('live.workbench.transcript.download.toast.failed'))
    } finally {
      exportDownloadingRef.current = false
      setExportDownloading(false)
    }
  }

  function handleSettingsToggle(): void {
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }

    setSettingsDraft(pickLiveWorkbenchSettingsDraft(draft, settingsFieldKeys))
    setSettingsOpen(true)
  }

  function handleSettingsDraftChange(key: string, value: LiveRealtimeDraftValue | undefined): void {
    if (!defaults || !settingsEditable || !supportsSessionRuntimeOverrides) return

    setSettingsDraft((current) =>
      value === undefined
        ? clearLiveRealtimeDraftValue(current, key)
        : updateLiveRealtimeDraft(current, defaults, key, value),
    )
  }

  function handleApplySettingsDraft(): void {
    if (!settingsEditable || !supportsSessionRuntimeOverrides || settingsDraftMatchesSession) return

    setDraft((current) =>
      mergeLiveWorkbenchSettingsDraft(current, settingsDraft, settingsFieldKeys),
    )
  }

  function handleResetSettingsDraft(): void {
    if (!settingsEditable) return

    setSettingsDraft(pickLiveWorkbenchSettingsDraft(draft, settingsFieldKeys))
  }

  function handleSaveSettingsDefaults(): void {
    if (
      !settingsEditable ||
      !supportsSessionRuntimeOverrides ||
      !settingsDraftHasChanges ||
      settingsMutationPending
    ) {
      return
    }

    saveDefaultsMutation.mutate(buildLiveRealtimeDefaultsPatchPayload(settingsDraft))
  }

  function handleResetSavedDefaults(): void {
    if (!settingsEditable || !supportsSessionRuntimeOverrides || settingsMutationPending) return

    resetDefaultsMutation.mutate()
  }

  function handleSettingsRetry(): void {
    void defaultsQuery.refetch()
    void schemaQuery.refetch()
  }

  function showRuntimeErrorToast(error: LiveRealtimeRuntimeError): void {
    const copy = selectLiveWorkbenchErrorCopy(error)
    toast.error(t(copy?.descriptionKey ?? 'live.workbench.errors.generic.description'))
  }

  function runLiveDeviceAction(action: Promise<unknown> | undefined, actionName: string): void {
    void Promise.resolve(action).catch((error: unknown) => {
      logger.warn(`Live device action failed: ${actionName}`, error)
    })
  }

  function reportRuntimeError(code: LiveRealtimeRuntimeErrorCode): LiveRealtimeRuntimeError {
    const error = buildLiveWorkbenchRuntimeError(code)
    useLiveRealtimeStore.getState().setLiveRealtimeFailure(error)
    showRuntimeErrorToast(error)
    return error
  }

  function getSessionStartErrorCode(): LiveRealtimeRuntimeErrorCode | null {
    if (selectedSources.length === 0) {
      return 'live_source_required'
    }

    if (!hasDefaults || defaultsQuery.error || schemaQuery.error) {
      return 'runtime_config_invalid'
    }

    if (downloadedModels.length === 0) {
      return 'runtime_model_not_downloaded'
    }

    if (!selectedModelId) {
      return 'runtime_model_not_configured'
    }

    if (!downloadedModelIds.has(selectedModelId)) {
      return 'runtime_model_not_registered'
    }

    if (
      microphoneEnabled &&
      !canStartMicrophoneCapture({
        enabled: true,
        capability: microphoneCapability,
        microphoneCount: microphoneDevices.length,
      })
    ) {
      return microphoneCapability === 'unsupported'
        ? 'microphone_capture_unsupported'
        : 'microphone_capture_failed'
    }

    if (
      systemAudioEnabled &&
      !canStartSystemAudioCapture({
        enabled: true,
        capability: systemAudioCapability,
      })
    ) {
      return 'system_audio_capture_unsupported'
    }

    return null
  }

  async function stopUnreusedSetupCapturesBeforeSession({
    microphone,
    system,
  }: {
    microphone: LiveCaptureSession | null
    system: LiveCaptureSession | null
  }): Promise<void> {
    if (microphoneCaptureActive && !microphone) {
      await liveDevices.stopMicrophoneCapture()
    }

    if (systemAudioCaptureActive && !system) {
      await liveDevices.stopSystemAudioCapture()
    }
  }

  async function stopOwnedPreparedCapturesAfterStartFailure(
    captureSessions: Partial<Record<LiveAudioSourceKind, LiveCaptureSession>>,
  ): Promise<void> {
    if (
      captureSessions.microphone &&
      liveDevices.getActiveMicrophoneCaptureSession()?.id === captureSessions.microphone.id
    ) {
      await liveDevices.stopMicrophoneCapture()
    }

    if (
      captureSessions.system &&
      liveDevices.getActiveSystemAudioCaptureSession()?.id === captureSessions.system.id
    ) {
      await liveDevices.stopSystemAudioCapture()
    }
  }

  async function prepareCaptureSessionsForSession(): Promise<PreparedLiveCaptureSessions | null> {
    const prepared: PreparedLiveCaptureSessions = {
      sessions: {},
      ownedByStart: {},
    }

    if (microphoneEnabled) {
      const existingMicrophone = liveDevices.getActiveMicrophoneCaptureSession()
      const microphone =
        existingMicrophone ??
        (await liveDevices.startMicrophoneCapture({
          deviceId: liveDevices.selectedMicrophoneId,
        }))

      if (!microphone) {
        reportRuntimeError(
          microphoneCapability === 'unsupported'
            ? 'microphone_capture_unsupported'
            : 'microphone_capture_failed',
        )
        return null
      }

      prepared.sessions.microphone = microphone
      if (!existingMicrophone) {
        prepared.ownedByStart.microphone = microphone
      }
    }

    if (systemAudioEnabled) {
      const existingSystem = liveDevices.getActiveSystemAudioCaptureSession()
      const system = existingSystem ?? (await liveDevices.startSystemAudioCapture())

      if (!system) {
        await stopOwnedPreparedCapturesAfterStartFailure(prepared.ownedByStart)
        reportRuntimeError(
          systemAudioCapability === 'unsupported'
            ? 'system_audio_capture_unsupported'
            : 'system_audio_capture_failed',
        )
        return null
      }

      prepared.sessions.system = system
      if (!existingSystem) {
        prepared.ownedByStart.system = system
      }
    }

    return prepared
  }

  function buildSessionRuntimeDraft(): LiveRealtimeDraft {
    if (!supportsSessionRuntimeOverrides) {
      return {}
    }

    const runtimeDraft: LiveRealtimeDraft = { ...draft }

    if (selectedEngineDevice && selectedEngineDevice !== config?.engine.device) {
      runtimeDraft.device = selectedEngineDevice
    }

    if (selectedEngineComputeType && selectedEngineComputeType !== config?.engine.compute_type) {
      runtimeDraft.compute_type = selectedEngineComputeType
    }

    return runtimeDraft
  }

  async function handleStartSession(): Promise<void> {
    if (sessionPreparing) return
    if (!selectLiveWorkbenchCanStartSession(liveRunState)) return
    const sessionStartErrorCode = getSessionStartErrorCode()
    if (sessionStartErrorCode) {
      reportRuntimeError(sessionStartErrorCode)
      return
    }

    setSessionPreparing(true)
    let ownedCaptureSessions: Partial<Record<LiveAudioSourceKind, LiveCaptureSession>> = {}

    try {
      setSystemAudioTestSessionId(null)
      const preparedCaptures = await prepareCaptureSessionsForSession()
      if (!preparedCaptures) return
      ownedCaptureSessions = preparedCaptures.ownedByStart

      await stopUnreusedSetupCapturesBeforeSession({
        microphone: preparedCaptures.sessions.microphone ?? null,
        system: preparedCaptures.sessions.system ?? null,
      })

      const service = createLiveRealtimeSessionService()
      const runtimeDraft = buildSessionRuntimeDraft()
      const startOptions: LiveRealtimeSessionStartOptions = {
        title: t('live.workbench.sessionTitle'),
        modelId: selectedModelId,
        languageHint: typeof resolvedLanguage === 'string' ? resolvedLanguage : null,
        sources: selectedSources,
        microphoneCapture: {
          deviceId: liveDevices.selectedMicrophoneId,
        },
        captureSessions: preparedCaptures.sessions,
      }
      if (Object.keys(runtimeDraft).length > 0) {
        startOptions.runtimeOverrides = buildLiveRealtimeRuntimeOverrides(runtimeDraft)
      }
      sessionServiceRef.current = service
      await service.start(startOptions)
    } catch (error) {
      const runtimeError = normalizeLiveWorkbenchCaughtError(error, 'live_session_start_failed')
      useLiveRealtimeStore.getState().setLiveRealtimeFailure(runtimeError)
      showRuntimeErrorToast(runtimeError)
      await stopOwnedPreparedCapturesAfterStartFailure(ownedCaptureSessions)
    } finally {
      setSessionPreparing(false)
    }
  }

  async function handleStopSession(): Promise<void> {
    const service = sessionServiceRef.current
    if (!service || !selectLiveWorkbenchCanStopSession(liveRunState)) return

    try {
      await service.stop()
    } catch (error) {
      const runtimeError = normalizeLiveWorkbenchCaughtError(error, 'live_session_stop_failed')
      showRuntimeErrorToast(runtimeError)
    }
  }

  function handleSessionAction(): void {
    if (sessionPreparing) return

    if (liveRunState === 'active') {
      void handleStopSession()
      return
    }

    void handleStartSession()
  }

  return (
    <ContentCanvas
      as="main"
      width="full"
      height="fill"
      className="gap-5 overflow-hidden px-0 py-0"
      data-slot="live-workbench-page"
    >
      <div
        data-slot="live-workbench-body"
        className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden"
      >
        <LiveWorkbenchStatusBar
          items={statusItems}
          actions={
            <Button
              type="button"
              size="sm"
              variant={liveRunState === 'active' ? 'outline' : 'default'}
              disabled={liveRunState === 'active' ? stopButtonDisabled : startButtonDisabled}
              onClick={handleSessionAction}
            >
              {liveRunState === 'active' || liveRunState === 'finishing' ? (
                <Square className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
              {sessionActionLabel}
            </Button>
          }
        />

        <div className="flex min-h-0 gap-4 overflow-hidden max-lg:flex-col max-lg:overflow-y-auto lg:h-full">
          <div
            data-slot="live-workbench-work-area"
            className={cn(
              'grid min-h-0 flex-1 overflow-hidden lg:h-full',
              transcriptExpanded
                ? 'grid-rows-[0_minmax(0,1fr)] gap-0'
                : 'grid-rows-[auto_minmax(0,1fr)] gap-4',
            )}
          >
            <div
              data-slot="live-workbench-session-setup-region"
              aria-hidden={transcriptExpanded}
              inert={transcriptExpanded || undefined}
              className={cn(
                'min-h-0 overflow-hidden transition-opacity duration-150',
                transcriptExpanded ? 'pointer-events-none opacity-0' : 'opacity-100',
              )}
            >
              <LiveWorkbenchSessionSetup
                modelValue={modelValue}
                modelOptions={modelOptions}
                modelDisabled={isModelsLoading || downloadedModels.length === 0}
                taskValue={taskValue}
                taskOptions={taskOptions}
                taskDisabled={
                  !hasDefaults ||
                  !supportsSessionRuntimeOverrides ||
                  schemaQuery.isPending ||
                  !taskField ||
                  taskOptionValues.size === 0
                }
                taskLabel={
                  taskField ? t(taskField.label_key) : t('live.workbench.sessionSetup.task.label')
                }
                languageValue={languageValue}
                languageOptions={languageOptions}
                languageDisabled={
                  !hasDefaults ||
                  !supportsSessionRuntimeOverrides ||
                  schemaQuery.isPending ||
                  isConfigLoading ||
                  !languageField ||
                  languageOptionValues.size === 0
                }
                languageLabel={
                  languageField
                    ? t(languageField.label_key)
                    : t('live.workbench.sessionSetup.language.label')
                }
                engineDeviceValue={engineDeviceValue}
                engineDeviceOptions={engineDeviceOptions}
                engineDeviceDisabled={
                  isConfigLoading ||
                  !supportsSessionRuntimeOverrides ||
                  engineDeviceOptionValues.size === 0
                }
                engineDeviceLabel={t('tasks.workbench.sessionConfig.device.label')}
                engineComputeTypeValue={engineComputeTypeValue}
                engineComputeTypeOptions={engineComputeTypeOptions}
                engineComputeTypeDisabled={
                  isConfigLoading ||
                  !supportsSessionRuntimeOverrides ||
                  engineComputeTypeOptionValues.size === 0
                }
                engineComputeTypeLabel={t('tasks.workbench.sessionConfig.computeType.label')}
                microphoneEnabled={microphoneEnabled}
                microphoneValue={microphoneValue}
                microphoneOptions={microphoneOptions}
                microphoneDisabled={microphoneDisabled}
                microphoneStatus={t(microphoneStatus.i18nKey)}
                microphoneStatusTone={microphoneStatus.tone}
                microphoneLevelPercent={selectLiveWorkbenchDisplayedAudioLevelPercent({
                  enabled: microphoneEnabled,
                  state: liveDevices.microphoneCapture.state,
                  level: liveDevices.microphoneCapture.level,
                })}
                microphoneActionLabel={t(
                  microphoneActionMode === 'stop'
                    ? 'live.workbench.sessionSetup.microphone.actions.stop'
                    : 'live.workbench.sessionSetup.microphone.actions.test',
                )}
                microphoneActionDisabled={microphoneActionDisabled}
                microphoneActionMode={microphoneActionMode}
                microphoneToggleLabel={t('live.workbench.sessionSetup.microphone.toggle')}
                systemAudioEnabled={systemAudioEnabled}
                systemAudioDisabled={systemAudioDisabled}
                systemAudioStatus={t(systemAudioStatus.i18nKey)}
                systemAudioStatusTone={systemAudioStatus.tone}
                systemAudioLevelPercent={selectLiveWorkbenchDisplayedAudioLevelPercent({
                  enabled:
                    systemAudioEnabled && (systemAudioTestVisible || sessionAudioLevelVisible),
                  state: liveDevices.systemAudioCapture.state,
                  level: liveDevices.systemAudioCapture.level,
                })}
                systemAudioCaptureSourceActionLabel={t(
                  systemAudioCaptureSourceActionMode === 'stop'
                    ? 'live.workbench.sessionSetup.systemAudio.actions.stop'
                    : 'live.workbench.sessionSetup.systemAudio.actions.start',
                )}
                systemAudioCaptureSourceActionDisabled={systemAudioCaptureSourceActionDisabled}
                systemAudioCaptureSourceActionMode={systemAudioCaptureSourceActionMode}
                systemAudioActionLabel={t(
                  systemAudioTestActionMode === 'stop'
                    ? 'live.workbench.sessionSetup.systemAudio.actions.stopTest'
                    : 'live.workbench.sessionSetup.systemAudio.actions.test',
                )}
                systemAudioActionDisabled={systemAudioTestActionDisabled}
                systemAudioActionMode={systemAudioTestActionMode}
                systemAudioToggleLabel={t('live.workbench.sessionSetup.systemAudio.toggle')}
                settingsOpen={settingsOpen}
                onModelChange={handleModelChange}
                onTaskChange={handleTaskChange}
                onLanguageChange={handleLanguageChange}
                onEngineDeviceChange={handleEngineDeviceChange}
                onEngineComputeTypeChange={handleEngineComputeTypeChange}
                onMicrophoneEnabledChange={handleMicrophoneEnabledChange}
                onMicrophoneChange={handleMicrophoneChange}
                onMicrophoneAction={handleMicrophoneAction}
                onSystemAudioEnabledChange={handleSystemAudioEnabledChange}
                onSystemAudioCaptureSourceAction={handleSystemAudioCaptureSourceAction}
                onSystemAudioTestAction={handleSystemAudioTestAction}
                onSettingsToggle={handleSettingsToggle}
              />
            </div>
            <LiveWorkbenchTranscriptPanel
              items={transcriptItems}
              emptyTitle={transcriptEmptyTitle}
              emptyDescription={transcriptEmptyDescription}
              errorCopy={errorCopy}
              onRetry={liveLastError?.retryable ? handleStartSession : undefined}
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('live.workbench.transcript.download.action')}
                    disabled={downloadTranscriptDisabled}
                    onClick={() => {
                      void handleDownloadTranscript()
                    }}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t(
                      transcriptExpanded
                        ? 'live.workbench.transcript.actions.restore'
                        : 'live.workbench.transcript.actions.expand',
                    )}
                    aria-pressed={transcriptExpanded}
                    onClick={handleTranscriptFocusToggle}
                  >
                    {transcriptExpanded ? (
                      <Minimize2 className="size-4" />
                    ) : (
                      <Maximize2 className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('live.workbench.compact.open')}
                    disabled={!hasTranscript && liveRunState !== 'active'}
                    onClick={() => {
                      void handleOpenCompactView()
                    }}
                  >
                    <PictureInPicture2 className="size-4" />
                  </Button>
                </>
              }
            />
          </div>
          <LiveWorkbenchSettingsPanel
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            runState={liveRunState}
            resolvedSnapshot={liveSession?.runtime_config ?? null}
            defaults={defaults}
            schema={settingsSchema}
            adapter={resolveLiveRealtimeSchemaAdapter(liveSession?.runtime ?? liveRuntimeAdapter)}
            draft={settingsDraft}
            languages={config?.effective_languages ?? []}
            loading={defaultsQuery.isPending || schemaQuery.isPending}
            unavailable={Boolean(defaultsQuery.error || schemaQuery.error)}
            controlsDisabled={settingsControlsDisabled || !supportsSessionRuntimeOverrides}
            applyDisabled={
              !supportsSessionRuntimeOverrides ||
              !settingsEditable ||
              settingsDraftMatchesSession ||
              settingsMutationPending
            }
            resetDraftDisabled={
              !settingsEditable || settingsDraftMatchesSession || settingsMutationPending
            }
            saveDefaultsDisabled={
              !supportsSessionRuntimeOverrides ||
              !settingsEditable ||
              !settingsDraftHasChanges ||
              settingsMutationPending
            }
            resetSavedDefaultsDisabled={
              !supportsSessionRuntimeOverrides || !settingsEditable || settingsMutationPending
            }
            savingDefaults={saveDefaultsMutation.isPending}
            resettingDefaults={resetDefaultsMutation.isPending}
            onDraftChange={handleSettingsDraftChange}
            onApplyDraft={handleApplySettingsDraft}
            onResetDraft={handleResetSettingsDraft}
            onSaveDefaults={handleSaveSettingsDefaults}
            onResetSavedDefaults={handleResetSavedDefaults}
            onRetry={handleSettingsRetry}
          />
        </div>
      </div>

      {compactOpen && compactWindow
        ? createPortal(
            <LiveWorkbenchCompactView
              open
              background="transparent"
              status={sessionStatusLabel}
              duration={durationLabel}
              items={transcriptItems}
              microphoneEnabled={microphoneEnabled}
              microphoneStatus={t(microphoneStatus.i18nKey)}
              systemAudioEnabled={systemAudioEnabled}
              systemAudioStatus={t(systemAudioStatus.i18nKey)}
              stopDisabled={stopButtonDisabled}
              onOpenChange={handleCompactOpenChange}
              onExpand={handleCompactExpand}
              onStop={handleStopSession}
            />,
            compactWindow.document.body,
          )
        : null}
    </ContentCanvas>
  )
}
