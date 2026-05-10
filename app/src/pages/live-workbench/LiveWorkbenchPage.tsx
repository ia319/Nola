import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  deleteLiveRealtimeDefaults,
  fetchLiveRealtimeDefaults,
  fetchLiveRealtimeSchema,
  patchLiveRealtimeDefaults,
} from '@/config/api'
import logger from '@/config/logger'
import { useAppConfig } from '@/config/use-app-config'
import { DEFAULT_MODEL_LIST_QUERY, useModels, type ModelListQuery } from '@/features/models'
import {
  areLiveRealtimeDraftValuesEqual,
  buildLiveRealtimeDefaultsPatchPayload,
  clearLiveRealtimeDraftValue,
  isTemporaryLiveDeviceId,
  resolveLiveRealtimeEffectiveValue,
  updateLiveRealtimeDraft,
  useLiveDeviceInventory,
  useLiveRealtimeStore,
  type LiveAudioDevice,
  type LiveCaptureSlotState,
  type LiveDeviceCapabilityState,
  type LiveDeviceInventoryErrorCode,
  type LiveDeviceInventoryStatus,
  type LiveDeviceWarningCode,
  type LiveRealtimeDraft,
  type LiveRealtimeDraftValue,
  type LiveRealtimeRunState,
} from '@/features/realtime'
import { ContentCanvas } from '@/layouts'
import { isAppError } from '@/shared/lib/error-factory'
import { queryKeys } from '@/shared/lib/query-keys'
import type {
  AppError,
  LiveRealtimeDefaultsResponse,
  LiveRealtimeDefaultsUpdateRequest,
  LiveRealtimeOptionGroup,
} from '@/shared/types'
import {
  formatLiveWorkbenchCount,
  formatLiveWorkbenchEmptyValue,
} from './live-workbench-formatters'
import {
  EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS,
  LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE,
  LIVE_WORKBENCH_DEFAULT_MICROPHONE_VALUE,
  LIVE_WORKBENCH_MODEL_EMPTY_VALUE,
  LIVE_WORKBENCH_MODEL_LOADING_VALUE,
  LIVE_WORKBENCH_MICROPHONE_EMPTY_VALUE,
  LIVE_WORKBENCH_MICROPHONE_LOADING_VALUE,
  LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
  selectLiveWorkbenchDisplayedAudioLevelPercent,
  resolveLiveWorkbenchInitialModelId,
  selectLiveWorkbenchIsCaptureActive,
  selectLiveWorkbenchDownloadedModels,
  selectLiveWorkbenchHasTranscript,
  selectLiveWorkbenchSelectField,
} from './live-workbench-selectors'
import { LiveWorkbenchCompactView } from './LiveWorkbenchCompactView'
import {
  LiveWorkbenchSessionSetup,
  type LiveWorkbenchSourceTone,
  type LiveWorkbenchSessionSetupOption,
} from './LiveWorkbenchSessionSetup'
import { LiveWorkbenchSettingsPanel } from './LiveWorkbenchSettingsPanel'
import { LiveWorkbenchStatusBar, type LiveWorkbenchStatusItem } from './LiveWorkbenchStatusBar'
import { LiveWorkbenchTranscriptPanel } from './LiveWorkbenchTranscriptPanel'

const LIVE_WORKBENCH_MODEL_QUERY = {
  ...DEFAULT_MODEL_LIST_QUERY,
  status: 'downloaded',
} satisfies ModelListQuery

const EMPTY_LIVE_AUDIO_DEVICES: readonly LiveAudioDevice[] = []
const EMPTY_LIVE_DEVICE_WARNINGS: readonly LiveDeviceWarningCode[] = []
const EMPTY_LIVE_REALTIME_SCHEMA: LiveRealtimeOptionGroup[] = []
const LIVE_WORKBENCH_MAIN_SETTING_KEYS: ReadonlySet<string> = new Set(['task', 'language'])

interface LiveWorkbenchSourceStatus {
  i18nKey: string
  tone: LiveWorkbenchSourceTone
}

function ignoreOpenChange() {
  return undefined
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

export function LiveWorkbenchPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { config, isLoading: isConfigLoading } = useAppConfig()
  const liveRunState = useLiveRealtimeStore((state) => state.runState)
  const {
    models,
    configuredModelId,
    lastLoadedModelId,
    isLoading: isModelsLoading,
  } = useModels(LIVE_WORKBENCH_MODEL_QUERY)
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
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true)
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false)
  const liveDevices = useLiveDeviceInventory()
  const emptyValue = formatLiveWorkbenchEmptyValue()
  const hasTranscript = selectLiveWorkbenchHasTranscript(EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS)
  const defaults = defaultsQuery.data?.defaults ?? null
  const schema = schemaQuery.data?.schema ?? EMPTY_LIVE_REALTIME_SCHEMA
  const settingsSchema = useMemo(() => buildLiveWorkbenchSettingsSchema(schema), [schema])
  const settingsFieldKeys = useMemo(
    () => buildLiveWorkbenchSettingsKeySet(settingsSchema),
    [settingsSchema],
  )
  const hasDefaults = defaults !== null
  const settingsEditable = canEditLiveWorkbenchSettings(liveRunState)
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
  const runtimeSummary = useMemo(() => {
    const device = config?.engine.device ?? null
    const computeType = config?.engine.compute_type ?? null

    if (!device && !computeType) {
      return emptyValue
    }

    return [device, computeType].filter(Boolean).join(' / ')
  }, [config?.engine.compute_type, config?.engine.device, emptyValue])
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
  const microphoneActionMode = microphoneCaptureActive ? 'stop' : 'test'
  const systemAudioActionMode = systemAudioCaptureActive ? 'stop' : 'test'
  const microphoneBusy =
    liveDevices.microphoneCapture.state === 'starting' ||
    liveDevices.microphoneCapture.state === 'stopping'
  const systemAudioBusy =
    liveDevices.systemAudioCapture.state === 'starting' ||
    liveDevices.systemAudioCapture.state === 'stopping'
  const microphoneDisabled =
    liveDevices.inventoryStatus === 'loading' ||
    microphoneCapability === 'unsupported' ||
    microphoneCapability === 'not_implemented' ||
    microphoneDevices.length === 0 ||
    Boolean(liveDevices.inventoryError)
  const systemAudioDisabled =
    liveDevices.inventoryStatus === 'loading' ||
    systemAudioCapability === 'unsupported' ||
    systemAudioCapability === 'not_implemented' ||
    Boolean(liveDevices.inventoryError)
  const microphoneActionDisabled =
    microphoneBusy ||
    (!microphoneCaptureActive &&
      !canStartMicrophoneCapture({
        enabled: microphoneEnabled,
        capability: microphoneCapability,
        microphoneCount: microphoneDevices.length,
      }))
  const systemAudioActionDisabled =
    systemAudioBusy ||
    (!systemAudioCaptureActive &&
      !canStartSystemAudioCapture({
        enabled: systemAudioEnabled,
        capability: systemAudioCapability,
      }))
  const statusItems: readonly LiveWorkbenchStatusItem[] = [
    {
      id: 'session',
      label: t('live.workbench.statusBar.session'),
      value: emptyValue,
    },
    {
      id: 'duration',
      label: t('live.workbench.statusBar.duration'),
      value: emptyValue,
    },
    {
      id: 'connection',
      label: t('live.workbench.statusBar.connection'),
      value: emptyValue,
    },
    {
      id: 'tracks',
      label: t('live.workbench.statusBar.tracks'),
      value: formatLiveWorkbenchCount(0),
    },
    {
      id: 'runtime',
      label: t('live.workbench.statusBar.runtime'),
      value: emptyValue,
    },
  ]

  function handleModelChange(value: string): void {
    if (downloadedModelIds.has(value)) {
      setSelectedModelOverrideId(value)
    }
  }

  function handleTaskChange(value: string): void {
    if (!defaults || !taskOptionValues.has(value)) return

    setDraft((current) => updateLiveRealtimeDraft(current, defaults, 'task', value))
  }

  function handleLanguageChange(value: string): void {
    if (!defaults || !languageOptionValues.has(value)) return

    const nextValue = value === LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE ? null : value
    setDraft((current) => updateLiveRealtimeDraft(current, defaults, 'language', nextValue))
  }

  function handleMicrophoneEnabledChange(enabled: boolean): void {
    setMicrophoneEnabled(enabled)
    if (!enabled && microphoneCaptureActive) {
      void liveDevices.stopMicrophoneCapture()
    }
  }

  function handleMicrophoneChange(value: string): void {
    if (!microphoneOptionValues.has(value)) return

    liveDevices.selectMicrophone(
      value === LIVE_WORKBENCH_DEFAULT_MICROPHONE_VALUE || isTemporaryLiveDeviceId(value)
        ? null
        : value,
    )
  }

  function handleMicrophoneAction(): void {
    if (microphoneCaptureActive) {
      void liveDevices.stopMicrophoneCapture()
      return
    }

    void liveDevices.startMicrophoneCapture({
      deviceId: liveDevices.selectedMicrophoneId,
    })
  }

  function handleSystemAudioEnabledChange(enabled: boolean): void {
    setSystemAudioEnabled(enabled)
    if (!enabled && systemAudioCaptureActive) {
      void liveDevices.stopSystemAudioCapture()
    }
  }

  function handleSystemAudioAction(): void {
    if (systemAudioCaptureActive) {
      void liveDevices.stopSystemAudioCapture()
      return
    }

    void liveDevices.startSystemAudioCapture()
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
    if (!defaults || !settingsEditable) return

    setSettingsDraft((current) =>
      value === undefined
        ? clearLiveRealtimeDraftValue(current, key)
        : updateLiveRealtimeDraft(current, defaults, key, value),
    )
  }

  function handleApplySettingsDraft(): void {
    if (!settingsEditable || settingsDraftMatchesSession) return

    setDraft((current) =>
      mergeLiveWorkbenchSettingsDraft(current, settingsDraft, settingsFieldKeys),
    )
  }

  function handleResetSettingsDraft(): void {
    if (!settingsEditable) return

    setSettingsDraft({})
  }

  function handleSaveSettingsDefaults(): void {
    if (!settingsEditable || !settingsDraftHasChanges || settingsMutationPending) return

    saveDefaultsMutation.mutate(buildLiveRealtimeDefaultsPatchPayload(settingsDraft))
  }

  function handleResetSavedDefaults(): void {
    if (!settingsEditable || settingsMutationPending) return

    resetDefaultsMutation.mutate()
  }

  function handleSettingsRetry(): void {
    void defaultsQuery.refetch()
    void schemaQuery.refetch()
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
        <LiveWorkbenchStatusBar items={statusItems} />

        <div className="flex min-h-0 gap-4 overflow-hidden max-lg:flex-col max-lg:overflow-y-auto lg:h-full">
          <div
            data-slot="live-workbench-work-area"
            className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden lg:h-full"
          >
            <LiveWorkbenchSessionSetup
              modelValue={modelValue}
              modelOptions={modelOptions}
              modelDisabled={isModelsLoading || downloadedModels.length === 0}
              taskValue={taskValue}
              taskOptions={taskOptions}
              taskDisabled={
                !hasDefaults || schemaQuery.isPending || !taskField || taskOptionValues.size === 0
              }
              taskLabel={
                taskField ? t(taskField.label_key) : t('live.workbench.sessionSetup.task.label')
              }
              languageValue={languageValue}
              languageOptions={languageOptions}
              languageDisabled={
                !hasDefaults ||
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
              runtimeSummary={runtimeSummary}
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
              systemAudioEnabled={systemAudioEnabled}
              systemAudioDisabled={systemAudioDisabled}
              systemAudioStatus={t(systemAudioStatus.i18nKey)}
              systemAudioStatusTone={systemAudioStatus.tone}
              systemAudioLevelPercent={selectLiveWorkbenchDisplayedAudioLevelPercent({
                enabled: systemAudioEnabled,
                state: liveDevices.systemAudioCapture.state,
                level: liveDevices.systemAudioCapture.level,
              })}
              systemAudioCaptureSource={t(
                'live.workbench.sessionSetup.systemAudio.captureSource.browserPrompt',
              )}
              systemAudioActionLabel={t(
                systemAudioActionMode === 'stop'
                  ? 'live.workbench.sessionSetup.systemAudio.actions.stop'
                  : 'live.workbench.sessionSetup.systemAudio.actions.test',
              )}
              systemAudioActionDisabled={systemAudioActionDisabled}
              systemAudioActionMode={systemAudioActionMode}
              settingsOpen={settingsOpen}
              onModelChange={handleModelChange}
              onTaskChange={handleTaskChange}
              onLanguageChange={handleLanguageChange}
              onMicrophoneEnabledChange={handleMicrophoneEnabledChange}
              onMicrophoneChange={handleMicrophoneChange}
              onMicrophoneAction={handleMicrophoneAction}
              onSystemAudioEnabledChange={handleSystemAudioEnabledChange}
              onSystemAudioAction={handleSystemAudioAction}
              onSettingsToggle={handleSettingsToggle}
            />
            <LiveWorkbenchTranscriptPanel hasTranscript={hasTranscript} />
          </div>
          <LiveWorkbenchSettingsPanel
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            runState={liveRunState}
            defaults={defaults}
            schema={settingsSchema}
            draft={settingsDraft}
            languages={config?.effective_languages ?? []}
            loading={defaultsQuery.isPending || schemaQuery.isPending}
            unavailable={Boolean(defaultsQuery.error || schemaQuery.error)}
            controlsDisabled={settingsControlsDisabled}
            applyDisabled={
              !settingsEditable || settingsDraftMatchesSession || settingsMutationPending
            }
            resetDraftDisabled={
              !settingsEditable || !settingsDraftHasChanges || settingsMutationPending
            }
            saveDefaultsDisabled={
              !settingsEditable || !settingsDraftHasChanges || settingsMutationPending
            }
            resetSavedDefaultsDisabled={!settingsEditable || settingsMutationPending}
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

      <LiveWorkbenchCompactView open={false} onOpenChange={ignoreOpenChange} />
    </ContentCanvas>
  )
}
