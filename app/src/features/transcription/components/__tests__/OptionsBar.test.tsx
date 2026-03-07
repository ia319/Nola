import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OptionsBar } from '../OptionsBar'
import type { UseTranscriptionOptionsReturn } from '@/features/transcription/types'
import type { AppError } from '@/shared/types'

const { createTaskMock, useTranscriptionOptionsMock, buildRequestMock } = vi.hoisted(() => ({
  createTaskMock: vi.fn(),
  useTranscriptionOptionsMock: vi.fn(),
  buildRequestMock: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (typeof params?.count === 'number') return `${key}:${params.count}`
      if (typeof params?.taskId === 'string') return `${key}:${params.taskId}`
      return key
    },
  }),
}))

vi.mock('@/config/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/transcription/api', () => ({
  createTask: createTaskMock,
}))

vi.mock('@/features/transcription/hooks/useTranscriptionOptions', () => ({
  useTranscriptionOptions: useTranscriptionOptionsMock,
}))

vi.mock('../AdvancedOptions', () => ({
  AdvancedOptions: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="advanced-options" data-disabled={String(Boolean(disabled))} />
  ),
}))

function buildHookReturn(
  overrides: Partial<UseTranscriptionOptionsReturn> = {},
): UseTranscriptionOptionsReturn {
  return {
    language: undefined,
    task: 'transcribe',
    advancedOptions: {},
    defaults: null,
    setLanguage: vi.fn(),
    setTask: vi.fn(),
    setAdvancedOption: vi.fn(),
    resetAdvancedOptions: vi.fn(),
    buildRequest: buildRequestMock,
    initialPrompt: undefined,
    setInitialPrompt: vi.fn(),
    ...overrides,
  }
}

describe('OptionsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildRequestMock.mockImplementation((fileId: string) => ({ file_id: fileId }))
    useTranscriptionOptionsMock.mockReturnValue(buildHookReturn())
  })

  it('disables task creation when no file ids are available', () => {
    render(<OptionsBar fileIds={[]} onTasksCreated={() => {}} />)

    const button = document.querySelector('#start-transcription') as HTMLButtonElement
    expect(button.textContent).toBe('options.startDisabled')
    expect(button.disabled).toBe(true)
  })

  it('forwards initial prompt edits and propagates disabled state', () => {
    const setInitialPrompt = vi.fn()
    useTranscriptionOptionsMock.mockReturnValue(
      buildHookReturn({
        initialPrompt: 'seed',
        setInitialPrompt,
      }),
    )

    render(<OptionsBar fileIds={['file-1']} onTasksCreated={() => {}} disabled />)

    const textarea = screen.getByLabelText('options.field.initialPrompt') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'new prompt' } })

    expect(setInitialPrompt).toHaveBeenCalledWith('new prompt')
    expect(textarea.disabled).toBe(true)
    expect(screen.getByTestId('advanced-options').getAttribute('data-disabled')).toBe('true')
  })

  it('creates tasks for all file ids and reports per-file outcomes', async () => {
    const onTasksCreated = vi.fn()
    const appError: AppError = {
      code: 'API_CLIENT_429',
      i18nKey: 'error.api.clientError',
      retriable: true,
    }

    createTaskMock.mockResolvedValueOnce({ task_id: 'task-1' }).mockRejectedValueOnce(appError)

    render(<OptionsBar fileIds={['file-1', 'file-2']} onTasksCreated={onTasksCreated} />)

    fireEvent.click(document.querySelector('#start-transcription') as HTMLButtonElement)

    await waitFor(() => {
      expect(onTasksCreated).toHaveBeenCalledWith([
        { fileId: 'file-1', taskId: 'task-1', ok: true },
        { fileId: 'file-2', ok: false, error: appError },
      ])
    })

    expect(buildRequestMock).toHaveBeenNthCalledWith(1, 'file-1')
    expect(buildRequestMock).toHaveBeenNthCalledWith(2, 'file-2')
  })

  it('falls back to a generic server error for unknown failures', async () => {
    const onTasksCreated = vi.fn()
    createTaskMock.mockRejectedValueOnce(new Error('boom'))

    render(<OptionsBar fileIds={['file-1']} onTasksCreated={onTasksCreated} />)

    fireEvent.click(document.querySelector('#start-transcription') as HTMLButtonElement)

    await waitFor(() => {
      expect(onTasksCreated).toHaveBeenCalledWith([
        {
          fileId: 'file-1',
          ok: false,
          error: {
            code: 'API_SERVER_UNKNOWN',
            i18nKey: 'error.api.serverError',
            retriable: true,
          },
        },
      ])
    })
  })
})
