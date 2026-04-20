// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ActiveModelDownload, ModelSettingsResponse, TaskSummary } from '@/shared/types'
import { useActivityStore } from '@/features/activity'

import { ActivityCenterSheet } from '../ActivityCenterSheet'

type TranslationParams = Record<string, string | number | boolean | null | undefined>

const messages: Record<string, string> = {
  'shell.activityCenter.title': 'Activity Center',
  'shell.activityCenter.description': 'System status and operational log.',
  'shell.activityCenter.close': 'Close activity center',
  'shell.activityCenter.sections.needsAttention': 'Needs Attention',
  'shell.activityCenter.sections.inProgress': 'In Progress',
  'shell.activityCenter.sections.recent': 'Recent',
  'shell.activityCenter.empty.needsAttention.title': 'No attention needed',
  'shell.activityCenter.empty.needsAttention.description':
    'Failed tasks and restart requirements appear here.',
  'shell.activityCenter.empty.inProgress.title': 'No active work',
  'shell.activityCenter.empty.inProgress.description':
    'Running tasks and model downloads appear here.',
  'shell.activityCenter.empty.recent.title': 'No recent activity',
  'shell.activityCenter.empty.recent.description':
    'Completed tasks and maintenance events appear here.',
  'shell.activityCenter.actions.dismiss': 'Dismiss {{label}}',
  'shell.activityCenter.actions.dismissAll': 'Dismiss all',
  'shell.activityCenter.actions.clearRecent': 'Clear Recent History',
  'shell.activityCenter.actions.openRoute': 'Open {{route}}',
  'shell.activityCenter.route.history': 'History',
  'shell.activityCenter.route.models': 'Models',
  'shell.activityCenter.route.systemInfo': 'System Info',
  'shell.activityCenter.items.failedTask': 'Failed task',
  'shell.activityCenter.items.restartRequired': 'Restart required',
  'shell.activityCenter.items.taskInProgress': 'Processing transcription',
  'shell.activityCenter.items.modelDownload': 'Active model download',
  'shell.activityCenter.items.taskCompleted': 'Completed transcription',
  'shell.activityCenter.items.modelDownloadCompleted': 'Model download finished',
  'shell.activityCenter.items.fileIntegrityChecked': 'File integrity checked',
  'shell.activityCenter.items.orphanCleanupCompleted': 'Orphan cleanup completed',
  'shell.activityCenter.items.taskId': 'Task {{taskId}}',
  'shell.activityCenter.items.configuredModel': 'Configured model: {{modelId}}',
  'shell.activityCenter.items.affectedCount': '{{count}} affected',
  'settings.modelStorage.values.empty': 'Not set',
  'settings.modelStorage.values.overrideSource.database': 'Stored setting',
  'tasks.status.failed': 'Failed',
  'tasks.status.processing': 'Processing',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: TranslationParams) => {
      let message = messages[key] ?? key
      for (const [name, value] of Object.entries(params ?? {})) {
        message = message.replace(`{{${name}}}`, String(value))
      }
      return message
    },
  }),
}))

function buildTask(taskId: string, overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `${taskId}.wav`,
    model_id: 'small',
    status: 'processing',
    progress: 65,
    created_at: '2026-04-20T10:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

function buildModelSettings(overrides: Partial<ModelSettingsResponse> = {}): ModelSettingsResponse {
  return {
    configured_model_id: 'large-v3',
    last_loaded_model_id: 'small',
    configured_model_dir: null,
    effective_model_dir: 'models',
    override_source: 'database',
    restart_required: true,
    ...overrides,
  }
}

function buildDownload(overrides: Partial<ActiveModelDownload> = {}): ActiveModelDownload {
  return {
    model_id: 'large-v3',
    name: 'Large V3',
    status: 'downloading',
    percent: 88,
    downloaded_bytes: 88_000_000,
    total_bytes: 100_000_000,
    speed_bps: 4_200_000,
    error: null,
    ...overrides,
  }
}

function seedActivityStore() {
  const store = useActivityStore.getState()
  store.setTasks([
    buildTask('failed-task', {
      filename: 'failed-task.wav',
      status: 'failed',
      progress: 20,
      completed_at: '2026-04-20T10:05:00.000Z',
    }),
    buildTask('running-task', {
      filename: 'running-task.wav',
      status: 'processing',
      progress: 65,
    }),
  ])
  store.setModelSettings(buildModelSettings())
  store.setModelDownloads([buildDownload()])
  store.addRecent({
    kind: 'model_download_completed',
    modelId: 'tiny',
    name: 'Tiny',
    occurredAt: '2026-04-20T10:06:00.000Z',
  })
}

afterEach(() => {
  useActivityStore.getState().clearActivity()
})

describe('ActivityCenterSheet', () => {
  it('renders attention, progress, and recent activity sections', () => {
    seedActivityStore()

    render(<ActivityCenterSheet open onOpenChange={vi.fn()} onNavigate={vi.fn()} />)

    expect(screen.getByText('Activity Center')).toBeTruthy()
    expect(screen.getByText('Needs Attention')).toBeTruthy()
    expect(screen.getByText('In Progress')).toBeTruthy()
    expect(screen.getByText('Recent')).toBeTruthy()
    expect(screen.getByText('Failed task')).toBeTruthy()
    expect(screen.getByText('Restart required')).toBeTruthy()
    expect(screen.getByText('running-task.wav')).toBeTruthy()
    expect(screen.getByText('Active model download')).toBeTruthy()
    expect(screen.getByText('Model download finished')).toBeTruthy()
  })

  it('dismisses individual activity and clears recent events', () => {
    seedActivityStore()

    render(<ActivityCenterSheet open onOpenChange={vi.fn()} onNavigate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Failed task' }))
    expect(screen.queryByText('failed-task.wav')).toBeNull()
    expect(screen.getByText('Restart required')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Clear Recent History' }))
    expect(screen.queryByText('Model download finished')).toBeNull()
    expect(screen.getByText('No recent activity')).toBeTruthy()
  })

  it('emits route navigation requests from activity rows', () => {
    const onNavigate = vi.fn()
    useActivityStore.getState().setTasks([
      buildTask('failed-task', {
        filename: 'failed-task.wav',
        status: 'failed',
        progress: 20,
        completed_at: '2026-04-20T10:05:00.000Z',
      }),
    ])

    render(<ActivityCenterSheet open onOpenChange={vi.fn()} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open History' }))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith('/history')
  })
})
