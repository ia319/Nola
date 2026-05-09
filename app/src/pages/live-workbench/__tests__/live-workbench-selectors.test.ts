import { describe, expect, it } from 'vitest'

import {
  EMPTY_LIVE_WORKBENCH_TRANSCRIPT_COUNTS,
  resolveLiveWorkbenchInitialModelId,
  selectLiveWorkbenchDownloadedModels,
  selectLiveWorkbenchHasTranscript,
  selectLiveWorkbenchSelectField,
} from '../live-workbench-selectors'
import type { LiveRealtimeOptionGroup, ModelResponse } from '@/shared/types'

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

  it('finds select fields from the live realtime schema', () => {
    expect(selectLiveWorkbenchSelectField(liveSchema, 'task')?.key).toBe('task')
    expect(selectLiveWorkbenchSelectField(liveSchema, 'missing')).toBeNull()
  })
})
