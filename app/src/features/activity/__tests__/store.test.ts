import { afterEach, describe, expect, it } from 'vitest'

import type { ActiveModelDownload, ModelSettingsResponse, TaskSummary } from '@/shared/types'

import { ACTIVITY_RECENT_LIMIT, selectActivityBadgeCount, useActivityStore } from '../store'

function buildTask(taskId: string, overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `${taskId}.wav`,
    model_id: 'small',
    status: 'pending',
    progress: 0,
    created_at: `2026-04-20T10:00:0${taskId.slice(-1)}.000Z`,
    completed_at: null,
    ...overrides,
  }
}

function buildModelSettings(overrides: Partial<ModelSettingsResponse> = {}): ModelSettingsResponse {
  return {
    configured_model_id: 'small',
    last_loaded_model_id: 'tiny',
    configured_model_dir: null,
    effective_model_dir: 'models',
    override_source: 'database',
    restart_required: false,
    ...overrides,
  }
}

function buildDownload(
  modelId: string,
  overrides: Partial<ActiveModelDownload> = {},
): ActiveModelDownload {
  return {
    model_id: modelId,
    name: modelId,
    status: 'downloading',
    percent: 25,
    downloaded_bytes: 25,
    total_bytes: 100,
    speed_bps: 5,
    error: null,
    ...overrides,
  }
}

afterEach(() => {
  useActivityStore.getState().clearActivity()
})

describe('activity store', () => {
  it('groups failed tasks and restart-required models under needs attention', () => {
    const store = useActivityStore.getState()

    store.setTasks([
      buildTask('task-1', {
        status: 'failed',
        completed_at: '2026-04-20T10:10:00.000Z',
      }),
      buildTask('task-2', { status: 'completed', completed_at: '2026-04-20T10:11:00.000Z' }),
    ])
    store.setModelSettings(buildModelSettings({ restart_required: true }))

    const snapshot = useActivityStore.getState()
    const attentionKinds = snapshot.needsAttention.map((item) => item.kind)
    expect(attentionKinds).toContain('model_restart_required')
    expect(attentionKinds).toContain('task_failed')
    expect(snapshot.needsAttention).toHaveLength(2)
    expect(selectActivityBadgeCount(snapshot)).toBe(2)
    expect(
      snapshot.needsAttention.find((item) => item.kind === 'model_restart_required')?.route,
    ).toBe('/models')
    expect(snapshot.needsAttention.find((item) => item.kind === 'task_failed')?.route).toBe(
      '/history',
    )
  })

  it('groups active tasks and active model downloads under in progress', () => {
    const store = useActivityStore.getState()

    store.setTasks([
      buildTask('task-1', { status: 'processing', progress: 40 }),
      buildTask('task-2', { status: 'pending' }),
      buildTask('task-3', { status: 'failed' }),
    ])
    store.setModelDownloads([
      buildDownload('small'),
      buildDownload('large-v3', { status: 'completed', percent: 100 }),
    ])

    const snapshot = useActivityStore.getState()
    const inProgressKinds = snapshot.inProgress.map((item) => item.kind)
    expect(inProgressKinds.filter((kind) => kind === 'task_in_progress')).toHaveLength(2)
    expect(inProgressKinds.filter((kind) => kind === 'model_download_in_progress')).toHaveLength(1)
    expect(
      snapshot.inProgress.find((item) => item.kind === 'model_download_in_progress'),
    ).toHaveProperty('download.modelId', 'small')
  })

  it('dismisses visible activity and keeps dismissed generated items hidden', () => {
    const store = useActivityStore.getState()
    const failedTask = buildTask('task-1', {
      status: 'failed',
      completed_at: null,
    })

    store.setTasks([failedTask])
    const failedActivityId = useActivityStore.getState().needsAttention[0]?.id
    if (!failedActivityId) {
      throw new Error('Expected failed task activity')
    }

    store.dismissActivity(failedActivityId)
    store.setTasks([
      {
        ...failedTask,
        completed_at: '2026-04-20T10:10:00.000Z',
      },
    ])

    const snapshot = useActivityStore.getState()
    expect(snapshot.needsAttention).toEqual([])
    expect(snapshot.dismissedIds[failedActivityId]).toBe(true)
  })

  it('stores recent events as a bounded newest-first queue', () => {
    const store = useActivityStore.getState()

    for (let index = 0; index < ACTIVITY_RECENT_LIMIT + 2; index += 1) {
      store.addRecent({
        kind: 'model_download_completed',
        modelId: `model-${index}`,
        name: `Model ${index}`,
        occurredAt: `2026-04-20T10:${String(index).padStart(2, '0')}:00.000Z`,
      })
    }
    store.addRecent({
      kind: 'model_download_completed',
      modelId: 'older-model',
      name: 'Older Model',
      occurredAt: '2026-04-20T09:00:00.000Z',
    })

    const snapshot = useActivityStore.getState()
    expect(snapshot.recent).toHaveLength(ACTIVITY_RECENT_LIMIT)
    expect(snapshot.recent[0]).toHaveProperty('model.modelId', `model-${ACTIVITY_RECENT_LIMIT + 1}`)
    expect(snapshot.recent.at(-1)).toHaveProperty('model.modelId', 'model-2')
  })

  it('clears attention, recent, and dismissed state through explicit actions', () => {
    const store = useActivityStore.getState()

    store.setTasks([
      buildTask('task-1', {
        status: 'failed',
        completed_at: '2026-04-20T10:10:00.000Z',
      }),
    ])
    store.addRecent({
      kind: 'system_maintenance_completed',
      event: 'file_integrity_checked',
      affectedCount: 1,
      occurredAt: '2026-04-20T10:12:00.000Z',
    })

    store.clearNeedsAttention()
    expect(useActivityStore.getState().needsAttention).toEqual([])
    expect(Object.keys(useActivityStore.getState().dismissedIds)).toHaveLength(1)

    store.clearRecent()
    expect(useActivityStore.getState().recent).toEqual([])

    store.clearDismissed()
    expect(useActivityStore.getState().dismissedIds).toEqual({})
  })
})
