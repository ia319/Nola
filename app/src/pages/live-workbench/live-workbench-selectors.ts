import type {
  LiveRealtimeOptionField,
  LiveRealtimeOptionGroup,
  ModelResponse,
} from '@/shared/types'
import type {
  LiveAudioLevel,
  LiveAudioSourceKind,
  LiveCaptureState,
  LiveRealtimeRuntimeError,
  LiveRealtimeRuntimeErrorCode,
  LiveRealtimeRunState,
  LiveRealtimeTranscriptCommittedPartialPayload,
  LiveRealtimeTranscriptFinalPayload,
  LiveRealtimeTranscriptPreviewPayload,
} from '@/features/realtime'

export interface LiveWorkbenchTranscriptCounts {
  finalCount: number
  committedPartialCount: number
  previewCount: number
}

export type LiveWorkbenchTranscriptItemKind = 'final' | 'committed_partial' | 'preview'

export interface LiveWorkbenchTranscriptItem {
  id: string
  kind: LiveWorkbenchTranscriptItemKind
  source: LiveAudioSourceKind
  trackId: string
  startMs: number
  endMs: number
  text: string
  language: string | null
  confidence: number | null
  sequence: number
}

export interface LiveWorkbenchErrorCopy {
  titleKey: string
  descriptionKey: string
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

export function selectLiveWorkbenchTranscriptCounts({
  finalTranscripts,
  committedPartials,
  previews,
}: {
  finalTranscripts: readonly LiveRealtimeTranscriptFinalPayload[]
  committedPartials: Record<string, LiveRealtimeTranscriptCommittedPartialPayload>
  previews: Record<string, LiveRealtimeTranscriptPreviewPayload>
}): LiveWorkbenchTranscriptCounts {
  return {
    finalCount: finalTranscripts.length,
    committedPartialCount: Object.keys(committedPartials).length,
    previewCount: Object.keys(previews).length,
  }
}

export function selectLiveWorkbenchTranscriptItems({
  finalTranscripts,
  committedPartials,
  previews,
}: {
  finalTranscripts: readonly LiveRealtimeTranscriptFinalPayload[]
  committedPartials: Record<string, LiveRealtimeTranscriptCommittedPartialPayload>
  previews: Record<string, LiveRealtimeTranscriptPreviewPayload>
}): LiveWorkbenchTranscriptItem[] {
  return [
    ...finalTranscripts.map(toFinalTranscriptItem),
    ...Object.values(committedPartials).map(toCommittedPartialTranscriptItem),
    ...Object.values(previews).map(toPreviewTranscriptItem),
  ].sort(compareTranscriptItems)
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

export function selectLiveWorkbenchCanStopSession(runState: LiveRealtimeRunState): boolean {
  return runState === 'active'
}

export function selectLiveWorkbenchCanStartSession(runState: LiveRealtimeRunState): boolean {
  return runState === 'idle' || runState === 'failed' || runState === 'finished'
}

export function selectLiveWorkbenchErrorCopy(
  error: LiveRealtimeRuntimeError | null,
): LiveWorkbenchErrorCopy | null {
  if (!error) return null

  return (
    LIVE_WORKBENCH_ERROR_COPY[error.code] ?? {
      titleKey: 'live.workbench.errors.generic.title',
      descriptionKey: 'live.workbench.errors.generic.description',
    }
  )
}

export function hasLiveWorkbenchErrorCopy(code: string): code is LiveRealtimeRuntimeErrorCode {
  return Object.prototype.hasOwnProperty.call(LIVE_WORKBENCH_ERROR_COPY, code)
}

function toFinalTranscriptItem(
  transcript: LiveRealtimeTranscriptFinalPayload,
): LiveWorkbenchTranscriptItem {
  return {
    id: `final:${transcript.segment_id}`,
    kind: 'final',
    source: transcript.source,
    trackId: transcript.track_id,
    startMs: transcript.start_ms,
    endMs: transcript.end_ms,
    text: transcript.text,
    language: transcript.language,
    confidence: transcript.confidence,
    sequence: transcript.sequence,
  }
}

function toCommittedPartialTranscriptItem(
  transcript: LiveRealtimeTranscriptCommittedPartialPayload,
): LiveWorkbenchTranscriptItem {
  return {
    id: `committed:${transcript.track_id}:${transcript.committed_index}`,
    kind: 'committed_partial',
    source: transcript.source,
    trackId: transcript.track_id,
    startMs: transcript.start_ms,
    endMs: transcript.end_ms,
    text: transcript.text,
    language: transcript.language,
    confidence: transcript.confidence,
    sequence: transcript.committed_index,
  }
}

function toPreviewTranscriptItem(
  transcript: LiveRealtimeTranscriptPreviewPayload,
): LiveWorkbenchTranscriptItem {
  return {
    id: `preview:${transcript.track_id}:${transcript.preview_index}`,
    kind: 'preview',
    source: transcript.source,
    trackId: transcript.track_id,
    startMs: transcript.start_ms,
    endMs: transcript.end_ms,
    text: transcript.text,
    language: transcript.language,
    confidence: transcript.confidence,
    sequence: transcript.preview_index,
  }
}

function compareTranscriptItems(
  left: LiveWorkbenchTranscriptItem,
  right: LiveWorkbenchTranscriptItem,
): number {
  return (
    left.startMs - right.startMs ||
    left.endMs - right.endMs ||
    compareTranscriptKind(left.kind) - compareTranscriptKind(right.kind) ||
    left.source.localeCompare(right.source) ||
    left.sequence - right.sequence
  )
}

function compareTranscriptKind(kind: LiveWorkbenchTranscriptItemKind): number {
  if (kind === 'final') return 0
  if (kind === 'committed_partial') return 1
  return 2
}

const LIVE_WORKBENCH_ERROR_COPY: Partial<
  Record<LiveRealtimeRuntimeErrorCode, LiveWorkbenchErrorCopy>
> = {
  live_source_required: {
    titleKey: 'live.workbench.errors.liveSourceRequired.title',
    descriptionKey: 'live.workbench.errors.liveSourceRequired.description',
  },
  runtime_model_not_configured: {
    titleKey: 'live.workbench.errors.runtimeModelNotConfigured.title',
    descriptionKey: 'live.workbench.errors.runtimeModelNotConfigured.description',
  },
  runtime_model_not_registered: {
    titleKey: 'live.workbench.errors.runtimeModelNotRegistered.title',
    descriptionKey: 'live.workbench.errors.runtimeModelNotRegistered.description',
  },
  runtime_model_not_downloaded: {
    titleKey: 'live.workbench.errors.runtimeModelNotDownloaded.title',
    descriptionKey: 'live.workbench.errors.runtimeModelNotDownloaded.description',
  },
  runtime_config_invalid: {
    titleKey: 'live.workbench.errors.runtimeConfigInvalid.title',
    descriptionKey: 'live.workbench.errors.runtimeConfigInvalid.description',
  },
  microphone_permission_required: {
    titleKey: 'live.workbench.errors.microphonePermissionRequired.title',
    descriptionKey: 'live.workbench.errors.microphonePermissionRequired.description',
  },
  microphone_permission_denied: {
    titleKey: 'live.workbench.errors.microphonePermissionDenied.title',
    descriptionKey: 'live.workbench.errors.microphonePermissionDenied.description',
  },
  microphone_device_unavailable: {
    titleKey: 'live.workbench.errors.microphoneDeviceUnavailable.title',
    descriptionKey: 'live.workbench.errors.microphoneDeviceUnavailable.description',
  },
  microphone_device_disconnected: {
    titleKey: 'live.workbench.errors.microphoneDeviceDisconnected.title',
    descriptionKey: 'live.workbench.errors.microphoneDeviceDisconnected.description',
  },
  microphone_capture_unsupported: {
    titleKey: 'live.workbench.errors.microphoneCaptureUnsupported.title',
    descriptionKey: 'live.workbench.errors.microphoneCaptureUnsupported.description',
  },
  microphone_capture_failed: {
    titleKey: 'live.workbench.errors.microphoneCaptureFailed.title',
    descriptionKey: 'live.workbench.errors.microphoneCaptureFailed.description',
  },
  system_audio_capture_unsupported: {
    titleKey: 'live.workbench.errors.systemAudioUnsupported.title',
    descriptionKey: 'live.workbench.errors.systemAudioUnsupported.description',
  },
  system_audio_permission_denied: {
    titleKey: 'live.workbench.errors.systemAudioPermissionDenied.title',
    descriptionKey: 'live.workbench.errors.systemAudioPermissionDenied.description',
  },
  system_audio_track_missing: {
    titleKey: 'live.workbench.errors.systemAudioTrackMissing.title',
    descriptionKey: 'live.workbench.errors.systemAudioTrackMissing.description',
  },
  system_audio_unavailable: {
    titleKey: 'live.workbench.errors.systemAudioUnavailable.title',
    descriptionKey: 'live.workbench.errors.systemAudioUnavailable.description',
  },
  system_audio_device_disconnected: {
    titleKey: 'live.workbench.errors.systemAudioDeviceDisconnected.title',
    descriptionKey: 'live.workbench.errors.systemAudioDeviceDisconnected.description',
  },
  system_audio_capture_failed: {
    titleKey: 'live.workbench.errors.systemAudioCaptureFailed.title',
    descriptionKey: 'live.workbench.errors.systemAudioCaptureFailed.description',
  },
  websocket_unavailable: {
    titleKey: 'live.workbench.errors.websocketUnavailable.title',
    descriptionKey: 'live.workbench.errors.websocketUnavailable.description',
  },
  websocket_connect_failed: {
    titleKey: 'live.workbench.errors.websocketConnectFailed.title',
    descriptionKey: 'live.workbench.errors.websocketConnectFailed.description',
  },
  websocket_closed: {
    titleKey: 'live.workbench.errors.websocketClosed.title',
    descriptionKey: 'live.workbench.errors.websocketClosed.description',
  },
  live_track_ready_timeout: {
    titleKey: 'live.workbench.errors.trackReadyTimeout.title',
    descriptionKey: 'live.workbench.errors.trackReadyTimeout.description',
  },
  live_session_finish_timeout: {
    titleKey: 'live.workbench.errors.sessionFinishTimeout.title',
    descriptionKey: 'live.workbench.errors.sessionFinishTimeout.description',
  },
  live_session_start_failed: {
    titleKey: 'live.workbench.errors.sessionStartFailed.title',
    descriptionKey: 'live.workbench.errors.sessionStartFailed.description',
  },
  live_session_stop_failed: {
    titleKey: 'live.workbench.errors.sessionStopFailed.title',
    descriptionKey: 'live.workbench.errors.sessionStopFailed.description',
  },
  live_session_state_invalid: {
    titleKey: 'live.workbench.errors.sessionStateInvalid.title',
    descriptionKey: 'live.workbench.errors.sessionStateInvalid.description',
  },
}
