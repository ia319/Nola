import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchLiveRealtimeDefaults, fetchLiveRealtimeSchema } from '@/config/api'
import { useAppConfig } from '@/config/use-app-config'
import { DEFAULT_MODEL_LIST_QUERY, useModels, type ModelListQuery } from '@/features/models'
import {
  resolveLiveRealtimeEffectiveValue,
  updateLiveRealtimeDraft,
  type LiveRealtimeDraft,
} from '@/features/realtime'
import { ContentCanvas } from '@/layouts'
import { queryKeys } from '@/shared/lib/query-keys'
import {
  formatLiveWorkbenchCount,
  formatLiveWorkbenchEmptyValue,
} from './live-workbench-formatters'
import {
  EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS,
  LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE,
  LIVE_WORKBENCH_MODEL_EMPTY_VALUE,
  LIVE_WORKBENCH_MODEL_LOADING_VALUE,
  LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE,
  resolveLiveWorkbenchInitialModelId,
  selectLiveWorkbenchDownloadedModels,
  selectLiveWorkbenchHasTranscript,
  selectLiveWorkbenchSelectField,
} from './live-workbench-selectors'
import { LiveWorkbenchCompactView } from './LiveWorkbenchCompactView'
import {
  LiveWorkbenchSessionSetup,
  type LiveWorkbenchSessionSetupOption,
} from './LiveWorkbenchSessionSetup'
import { LiveWorkbenchSettingsPanel } from './LiveWorkbenchSettingsPanel'
import { LiveWorkbenchStatusBar, type LiveWorkbenchStatusItem } from './LiveWorkbenchStatusBar'
import { LiveWorkbenchTranscriptPanel } from './LiveWorkbenchTranscriptPanel'

const LIVE_WORKBENCH_MODEL_QUERY = {
  ...DEFAULT_MODEL_LIST_QUERY,
  status: 'downloaded',
} satisfies ModelListQuery

function ignoreOpenChange() {
  return undefined
}

export function LiveWorkbenchPage() {
  const { t } = useTranslation()
  const { config, isLoading: isConfigLoading } = useAppConfig()
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
  const [selectedModelOverrideId, setSelectedModelOverrideId] = useState<string | null>(null)
  const emptyValue = formatLiveWorkbenchEmptyValue()
  const hasTranscript = selectLiveWorkbenchHasTranscript(EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS)
  const defaults = defaultsQuery.data?.defaults ?? null
  const schema = schemaQuery.data?.schema ?? []
  const hasDefaults = defaults !== null
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

    setDraft((current) =>
      updateLiveRealtimeDraft(
        current,
        defaults,
        'language',
        value === LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE ? null : value,
      ),
    )
  }

  return (
    <ContentCanvas
      as="main"
      width="full"
      height="fill"
      className="gap-5 px-0 py-0"
      data-slot="live-workbench-page"
    >
      <div
        data-slot="live-workbench-body"
        className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(420px,1fr)] gap-4"
      >
        <LiveWorkbenchStatusBar items={statusItems} />
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
          settingsOpen={settingsOpen}
          onModelChange={handleModelChange}
          onTaskChange={handleTaskChange}
          onLanguageChange={handleLanguageChange}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex min-h-0 gap-4">
          <LiveWorkbenchTranscriptPanel hasTranscript={hasTranscript} />
          <LiveWorkbenchSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
      </div>

      <LiveWorkbenchCompactView open={false} onOpenChange={ignoreOpenChange} />
    </ContentCanvas>
  )
}
