import type {
  LiveRealtimeOptionField,
  LiveRealtimeOptionGroup,
  ModelResponse,
} from '@/shared/types'
import type { LiveAudioLevel, LiveCaptureState } from '@/features/realtime'

export interface LiveWorkbenchTranscriptCounts {
  finalCount: number
  committedPartialCount: number
  previewCount: number
}

export const LIVE_WORKBENCH_AUTO_LANGUAGE_VALUE = '__auto__'
export const LIVE_WORKBENCH_DEFAULT_MICROPHONE_VALUE = '__default_microphone__'
export const LIVE_WORKBENCH_MODEL_EMPTY_VALUE = '__model_empty__'
export const LIVE_WORKBENCH_MODEL_LOADING_VALUE = '__model_loading__'
export const LIVE_WORKBENCH_MICROPHONE_EMPTY_VALUE = '__microphone_empty__'
export const LIVE_WORKBENCH_MICROPHONE_LOADING_VALUE = '__microphone_loading__'
export const LIVE_WORKBENCH_SELECT_UNAVAILABLE_VALUE = '__unavailable__'

export const EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS: LiveWorkbenchTranscriptCounts = {
  finalCount: 0,
  committedPartialCount: 0,
  previewCount: 0,
}

type LiveRealtimeSelectField = Extract<LiveRealtimeOptionField, { type: 'select' }>

export function selectLiveWorkbenchDownloadedModels(
  models: readonly ModelResponse[],
): ModelResponse[] {
  return models.filter((model) => model.status === 'downloaded')
}

function hasDownloadedModelId(
  downloadedModels: readonly ModelResponse[],
  modelId: string | null | undefined,
): modelId is string {
  return typeof modelId === 'string' && downloadedModels.some((model) => model.model_id === modelId)
}

export function resolveLiveWorkbenchInitialModelId({
  configuredModelId,
  lastLoadedModelId,
  downloadedModels,
}: {
  configuredModelId: string | null
  lastLoadedModelId: string | null
  downloadedModels: readonly ModelResponse[]
}): string | null {
  if (hasDownloadedModelId(downloadedModels, configuredModelId)) {
    return configuredModelId
  }

  if (hasDownloadedModelId(downloadedModels, lastLoadedModelId)) {
    return lastLoadedModelId
  }

  return downloadedModels[0]?.model_id ?? null
}

export function selectLiveWorkbenchSelectField(
  schema: readonly LiveRealtimeOptionGroup[],
  key: string,
): LiveRealtimeSelectField | null {
  for (const group of schema) {
    const field = group.fields.find((candidate) => candidate.key === key)
    if (field?.type === 'select') {
      return field
    }
  }

  return null
}

export function selectLiveWorkbenchHasTranscript(counts: LiveWorkbenchTranscriptCounts): boolean {
  return counts.finalCount > 0 || counts.committedPartialCount > 0 || counts.previewCount > 0
}

export function selectLiveWorkbenchAudioLevelPercent(level: LiveAudioLevel | null): number {
  if (!level || !Number.isFinite(level.level)) {
    return 0
  }

  if (level.level <= 0) {
    return 0
  }

  if (level.level >= 1) {
    return 100
  }

  return Math.round(level.level * 100)
}

export function selectLiveWorkbenchDisplayedAudioLevelPercent({
  enabled,
  state,
  level,
}: {
  enabled: boolean
  state: LiveCaptureState
  level: LiveAudioLevel | null
}): number {
  if (!enabled || state !== 'capturing') {
    return 0
  }

  return selectLiveWorkbenchAudioLevelPercent(level)
}

export function selectLiveWorkbenchIsCaptureActive(state: LiveCaptureState): boolean {
  return state === 'starting' || state === 'capturing' || state === 'paused' || state === 'stopping'
}
