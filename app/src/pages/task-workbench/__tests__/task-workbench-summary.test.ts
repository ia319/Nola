import { describe, expect, it } from 'vitest'

import type { UploadItem } from '@/features/upload'
import type { TaskSummary } from '@/shared/types'

import { buildTaskWorkbenchSummary } from '../task-workbench-summary'

function createUpload(overrides: Partial<UploadItem>): UploadItem {
  return {
    id: 'upload-id',
    file: new File(['audio'], 'sample.wav', { type: 'audio/wav' }),
    status: 'pending',
    progress: 0,
    error: null,
    fileId: null,
    taskCreated: false,
    ...overrides,
  }
}

function createTask(overrides: Partial<TaskSummary>): TaskSummary {
  return {
    task_id: 'task-id',
    file_id: 'file-id',
    filename: 'sample.wav',
    status: 'pending',
    progress: 0,
    created_at: '2026-04-10T08:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

describe('buildTaskWorkbenchSummary', () => {
  it('counts uploaded, ready, processing, and completed metrics from session state', () => {
    const uploads: UploadItem[] = [
      createUpload({
        id: 'upload-ready',
        status: 'success',
        progress: 100,
        fileId: 'file-ready',
      }),
      createUpload({
        id: 'upload-created',
        status: 'success',
        progress: 100,
        fileId: 'file-created',
        taskCreated: true,
      }),
      createUpload({
        id: 'upload-pending',
        status: 'pending',
      }),
    ]

    const tasks: TaskSummary[] = [
      createTask({
        task_id: 'task-pending',
        file_id: 'file-pending',
        status: 'pending',
      }),
      createTask({
        task_id: 'task-processing',
        file_id: 'file-processing',
        status: 'processing',
      }),
      createTask({
        task_id: 'task-completed',
        file_id: 'file-completed',
        status: 'completed',
        completed_at: '2026-04-10T08:05:00.000Z',
      }),
      createTask({
        task_id: 'task-failed',
        file_id: 'file-failed',
        status: 'failed',
      }),
    ]

    expect(buildTaskWorkbenchSummary(uploads, tasks)).toEqual({
      uploaded: 3,
      ready: 1,
      processing: 2,
      completed: 1,
    })
  })

  it('returns zero counts when the current session is empty', () => {
    expect(buildTaskWorkbenchSummary([], [])).toEqual({
      uploaded: 0,
      ready: 0,
      processing: 0,
      completed: 0,
    })
  })
})
