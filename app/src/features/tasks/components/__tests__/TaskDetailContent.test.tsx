// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TaskDetail } from '@/shared/types'
import { TaskDetailContent } from '../TaskDetailContent'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'history.table.modelFallback': 'Unknown model',
        'history.taskDetail.fields.duration': 'Duration',
        'history.taskDetail.fields.error': 'Error',
        'history.taskDetail.fields.model': 'Model',
        'history.taskDetail.sections.taskMetadata': 'Task Metadata',
        'history.taskDetail.sections.technicalProperties': 'Technical Properties',
        'history.taskDetail.sections.transcriptionResult': 'Transcription Result',
        'history.taskDetail.segments.empty.description': 'No segments yet',
        'history.taskDetail.segments.empty.title': 'No segments available',
        'history.taskDetail.technicalUnavailable.description': 'No technical properties yet',
        'history.taskDetail.technicalUnavailable.title': 'Technical properties unavailable',
        'tasks.fields.completedAt': 'Completed At',
        'tasks.fields.createdAt': 'Created At',
        'tasks.fields.progress': 'Progress',
      }

      return messages[key] ?? key
    },
  }),
}))

function createTask(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    task_id: 'task-1',
    file_id: 'file-1',
    filename: 'briefing.wav',
    model_id: 'large-v3',
    status: 'completed',
    progress: 50,
    created_at: '2026-04-11T10:00:00.000Z',
    completed_at: '2026-04-11T10:05:00.000Z',
    duration: 300,
    segments: null,
    error: null,
    ...overrides,
  }
}

describe('TaskDetailContent', () => {
  it('carries rounded duration seconds into the next minute', () => {
    render(<TaskDetailContent task={createTask({ duration: 59.999 })} />)

    expect(screen.getByText('01:00.00')).toBeInTheDocument()
    expect(screen.queryByText('00:60.00')).not.toBeInTheDocument()
  })

  it('uses the clamped progress value for the visible label', () => {
    render(<TaskDetailContent task={createTask({ progress: 120 })} />)

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.queryByText('120%')).not.toBeInTheDocument()
  })
})
