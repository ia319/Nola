import { describe, expect, it } from 'vitest'

import {
  EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS,
  resolveLiveWorkbenchInitialModelId,
  selectLiveWorkbenchErrorCopy,
  selectLiveWorkbenchAudioLevelPercent,
  selectLiveWorkbenchDisplayedAudioLevelPercent,
  selectLiveWorkbenchDownloadedModels,
  selectLiveWorkbenchHasTranscript,
  selectLiveWorkbenchIsCaptureActive,
  selectLiveWorkbenchSelectField,
  selectLiveWorkbenchTranscriptCounts,
  selectLiveWorkbenchTranscriptItems,
} from '../live-workbench-selectors'
import type { LiveRealtimeOptionGroup, ModelResponse } from '@/shared/types'
import type {
  LiveRealtimeTranscriptCommittedPartialPayload,
  LiveRealtimeTranscriptFinalPayload,
  LiveRealtimeTranscriptPreviewPayload,
} from '@/features/realtime'

function buildModel(overrides: Partial<ModelResponse> = {}): ModelResponse {
  return {
    model_id: 'small',
    name: 'Small',
    size_bytes: 1,
    repo_id: 'repo',
    languages: 'multilingual',
    speed_rank: 1,
    accuracy_rank: 1,
    description: 'desc',
    description_key: 'models.catalog.small.description',
    status: 'downloaded',
    disk_usage: 1,
    is_configured: false,
    is_last_loaded: false,
    download_progress: null,
    ...overrides,
  }
}

const liveSchema: LiveRealtimeOptionGroup[] = [
  {
    group: 'recognition',
    group_label_key: 'settings.liveRealtime.groups.recognition',
    fields: [
      {
        key: 'task',
        label_key: 'settings.liveRealtime.fields.task.label',
        description_key: 'settings.liveRealtime.fields.task.description',
        default_value: 'transcribe',
        supported_adapters: ['whisper_streaming'],
        depends_on: null,
        type: 'select',
        options: [
          {
            value: 'transcribe',
            label_key: 'settings.liveRealtime.values.task.transcribe',
          },
          {
            value: 'translate',
            label_key: 'settings.liveRealtime.values.task.translate',
          },
        ],
        options_source: null,
      },
    ],
  },
]

describe('live workbench selectors', () => {
  it('treats an empty transcript count set as empty', () => {
    expect(selectLiveWorkbenchHasTranscript(EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS)).toBe(false)
  })

  it('detects visible transcript stream items', () => {
    expect(
      selectLiveWorkbenchHasTranscript({
        finalCount: 0,
        committedPartialCount: 1,
        previewCount: 0,
      }),
    ).toBe(true)
  })

  it('keeps only downloaded models available for live setup', () => {
    expect(
      selectLiveWorkbenchDownloadedModels([
        buildModel({ model_id: 'small', status: 'downloaded' }),
        buildModel({ model_id: 'large-v3', status: 'not_downloaded' }),
      ]).map((model) => model.model_id),
    ).toEqual(['small'])
  })

  it('prefers configured model, then last loaded model, then first downloaded model', () => {
    const downloadedModels = [
      buildModel({ model_id: 'small' }),
      buildModel({ model_id: 'large-v3' }),
    ]

    expect(
      resolveLiveWorkbenchInitialModelId({
        configuredModelId: 'large-v3',
        lastLoadedModelId: 'small',
        downloadedModels,
      }),
    ).toBe('large-v3')
    expect(
      resolveLiveWorkbenchInitialModelId({
        configuredModelId: 'missing',
        lastLoadedModelId: 'small',
        downloadedModels,
      }),
    ).toBe('small')
    expect(
      resolveLiveWorkbenchInitialModelId({
        configuredModelId: 'missing',
        lastLoadedModelId: 'also-missing',
        downloadedModels,
      }),
    ).toBe('small')
  })

  it('returns null when no downloaded model is available', () => {
    expect(
      resolveLiveWorkbenchInitialModelId({
        configuredModelId: 'small',
        lastLoadedModelId: 'large-v3',
        downloadedModels: [],
      }),
    ).toBeNull()
  })

  it('finds select fields from the live realtime schema', () => {
    expect(selectLiveWorkbenchSelectField(liveSchema, 'task')?.key).toBe('task')
    expect(selectLiveWorkbenchSelectField(liveSchema, 'missing')).toBeNull()
  })

  it('normalizes live source level values for compact meters', () => {
    expect(selectLiveWorkbenchAudioLevelPercent(null)).toBe(0)
    expect(
      selectLiveWorkbenchAudioLevelPercent({
        level: 0.42,
        peak: 0.5,
        isMutedLike: false,
        measuredAt: 1,
      }),
    ).toBe(42)
    expect(
      selectLiveWorkbenchAudioLevelPercent({
        level: 2,
        peak: 2,
        isMutedLike: false,
        measuredAt: 1,
      }),
    ).toBe(100)
  })

  it('shows live source levels only while the source is capturing', () => {
    const level = {
      level: 0.42,
      peak: 0.5,
      isMutedLike: false,
      measuredAt: 1,
    }

    expect(
      selectLiveWorkbenchDisplayedAudioLevelPercent({
        enabled: true,
        state: 'capturing',
        level,
      }),
    ).toBe(42)
    expect(
      selectLiveWorkbenchDisplayedAudioLevelPercent({
        enabled: true,
        state: 'stopped',
        level,
      }),
    ).toBe(0)
    expect(
      selectLiveWorkbenchDisplayedAudioLevelPercent({
        enabled: false,
        state: 'capturing',
        level,
      }),
    ).toBe(0)
  })

  it('detects source capture states that should stop instead of start', () => {
    expect(selectLiveWorkbenchIsCaptureActive('idle')).toBe(false)
    expect(selectLiveWorkbenchIsCaptureActive('capturing')).toBe(true)
    expect(selectLiveWorkbenchIsCaptureActive('stopping')).toBe(true)
    expect(selectLiveWorkbenchIsCaptureActive('failed')).toBe(false)
  })

  it('combines transcript streams in chronological order', () => {
    const items = selectLiveWorkbenchTranscriptItems({
      finalTranscripts: [finalTranscript('track-1', 20)],
      committedPartials: {
        'track-1': committedPartialTranscript('track-1', 10),
      },
      previews: {
        'track-2': previewTranscript('track-2', 30),
      },
    })

    expect(items.map((item) => item.kind)).toEqual(['committed_partial', 'final', 'preview'])
    expect(
      selectLiveWorkbenchTranscriptCounts({
        finalTranscripts: [finalTranscript('track-1', 20)],
        committedPartials: {
          'track-1': committedPartialTranscript('track-1', 10),
        },
        previews: {
          'track-2': previewTranscript('track-2', 30),
        },
      }),
    ).toEqual({
      finalCount: 1,
      committedPartialCount: 1,
      previewCount: 1,
    })
  })

  it('maps runtime errors to user-facing copy keys without raw messages', () => {
    expect(
      selectLiveWorkbenchErrorCopy({
        code: 'runtime_model_not_downloaded',
        message: 'raw backend message',
        retryable: false,
      }),
    ).toEqual({
      titleKey: 'live.workbench.errors.runtimeModelNotDownloaded.title',
      descriptionKey: 'live.workbench.errors.runtimeModelNotDownloaded.description',
    })
  })

  it('maps native capture errors to source-specific copy keys', () => {
    expect(
      selectLiveWorkbenchErrorCopy({
        code: 'system_audio_unavailable',
        message: 'Windows HRESULT 0x88890004',
        retryable: true,
      }),
    ).toEqual({
      titleKey: 'live.workbench.errors.systemAudioUnavailable.title',
      descriptionKey: 'live.workbench.errors.systemAudioUnavailable.description',
    })
  })
})

function previewTranscript(trackId: string, startMs: number): LiveRealtimeTranscriptPreviewPayload {
  return {
    result_kind: 'preview',
    session_id: 'session-1',
    track_id: trackId,
    source: 'microphone',
    start_ms: startMs,
    end_ms: startMs + 1000,
    text: 'preview',
    language: null,
    confidence: null,
    is_final: false,
    preview_index: 1,
  }
}

function committedPartialTranscript(
  trackId: string,
  startMs: number,
): LiveRealtimeTranscriptCommittedPartialPayload {
  return {
    result_kind: 'committed_partial',
    session_id: 'session-1',
    track_id: trackId,
    source: 'microphone',
    start_ms: startMs,
    end_ms: startMs + 1000,
    text: 'partial',
    language: null,
    confidence: null,
    is_final: false,
    committed_index: 1,
  }
}

function finalTranscript(trackId: string, startMs: number): LiveRealtimeTranscriptFinalPayload {
  return {
    result_kind: 'final',
    segment_id: `segment-${trackId}`,
    session_id: 'session-1',
    track_id: trackId,
    source: 'microphone',
    sequence: 1,
    start_ms: startMs,
    end_ms: startMs + 1000,
    text: 'final',
    language: null,
    confidence: null,
    is_final: true,
    created_at: '2026-05-10T00:00:00.000Z',
  }
}
