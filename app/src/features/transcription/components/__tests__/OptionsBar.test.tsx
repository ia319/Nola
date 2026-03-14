import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OptionsBar } from '../OptionsBar'
import type { UseAppConfigReturn } from '@/config/use-app-config'
import type { UseTranscriptionOptionsReturn } from '@/features/transcription/types'
import type { AppError, TranscriptionDefaults } from '@/shared/types'

const {
  createTaskMock,
  useTranscriptionOptionsMock,
  buildRequestMock,
  fetchEngineDefaultsMock,
  patchTranscriptionDefaultsMock,
  deleteTranscriptionDefaultsMock,
  refreshAppConfigMock,
  useAppConfigMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  createTaskMock: vi.fn(),
  useTranscriptionOptionsMock: vi.fn(),
  buildRequestMock: vi.fn(),
  fetchEngineDefaultsMock: vi.fn(),
  patchTranscriptionDefaultsMock: vi.fn(),
  deleteTranscriptionDefaultsMock: vi.fn(),
  refreshAppConfigMock: vi.fn(),
  useAppConfigMock: vi.fn<() => UseAppConfigReturn>(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

vi.mock('@/config/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/config/api', () => ({
  fetchEngineDefaults: fetchEngineDefaultsMock,
  patchTranscriptionDefaults: patchTranscriptionDefaultsMock,
  deleteTranscriptionDefaults: deleteTranscriptionDefaultsMock,
}))

vi.mock('@/config/use-app-config', () => ({
  useAppConfig: (...args: unknown[]) => useAppConfigMock(...(args as [])),
  refreshAppConfig: (...args: unknown[]) => refreshAppConfigMock(...(args as [])),
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

function buildAppConfigReturn(): UseAppConfigReturn {
  return {
    config: {
      engine: {
        model_size: 'small',
        device: 'cpu',
        compute_type: 'default',
        is_multilingual: true,
      },
      transcription: { defaults: {} as TranscriptionDefaults, schema: [] },
      file: { allowed_extensions: [], allowed_mime_types: [], max_file_size: 0 },
      effective_languages: [],
    },
    fileValidationConfig: { allowedExtensions: [], allowedMimeTypes: [], maxFileSize: 0 },
    isLoading: false,
  }
}

function buildDefaults(values: Record<string, unknown>): TranscriptionDefaults {
  return values as unknown as TranscriptionDefaults
}

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
    resetOptionOverrides: vi.fn(),
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
    useAppConfigMock.mockReturnValue(buildAppConfigReturn())
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

  it('saves defaults via patch and refreshes shared app config', async () => {
    const defaults = buildDefaults({
      language: null,
      task: 'transcribe',
      beam_size: 3,
    })

    useTranscriptionOptionsMock.mockReturnValue(
      buildHookReturn({
        defaults,
        language: 'en',
        task: 'translate',
        advancedOptions: { beam_size: 4 },
      }),
    )

    fetchEngineDefaultsMock.mockResolvedValue({
      defaults: buildDefaults({
        language: null,
        task: 'transcribe',
        beam_size: 5,
      }),
    })
    patchTranscriptionDefaultsMock.mockResolvedValue({ defaults })
    refreshAppConfigMock.mockResolvedValue(buildAppConfigReturn().config)

    render(<OptionsBar fileIds={[]} onTasksCreated={() => {}} />)

    fireEvent.click(document.querySelector('#save-defaults') as HTMLButtonElement)

    await waitFor(() => {
      expect(fetchEngineDefaultsMock).toHaveBeenCalledTimes(1)
      expect(patchTranscriptionDefaultsMock).toHaveBeenCalledWith({
        language: 'en',
        task: 'translate',
        beam_size: 4,
      })
      expect(refreshAppConfigMock).toHaveBeenCalledTimes(1)
      expect(toastSuccessMock).toHaveBeenCalledWith('options.defaults.saved')
    })
  })

  it('shows an error toast when saving defaults fails', async () => {
    const defaults = buildDefaults({
      language: null,
      task: 'transcribe',
      beam_size: 3,
    })
    const appError: AppError = {
      code: 'API_CLIENT_400',
      i18nKey: 'error.api.clientError',
      retriable: false,
      params: { status: 400 },
    }

    useTranscriptionOptionsMock.mockReturnValue(
      buildHookReturn({
        defaults,
        language: 'en',
        task: 'translate',
        advancedOptions: { beam_size: 4 },
      }),
    )
    fetchEngineDefaultsMock.mockResolvedValue({
      defaults: buildDefaults({
        language: null,
        task: 'transcribe',
        beam_size: 5,
      }),
    })
    patchTranscriptionDefaultsMock.mockRejectedValue(appError)

    render(<OptionsBar fileIds={[]} onTasksCreated={() => {}} />)

    fireEvent.click(document.querySelector('#save-defaults') as HTMLButtonElement)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('error.api.clientError')
    })
    expect(refreshAppConfigMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('resets persisted defaults and clears local option overrides', async () => {
    const resetOptionOverrides = vi.fn()
    useTranscriptionOptionsMock.mockReturnValue(
      buildHookReturn({
        defaults: buildDefaults({
          language: 'ja',
          task: 'translate',
          beam_size: 3,
        }),
        resetOptionOverrides,
      }),
    )

    deleteTranscriptionDefaultsMock.mockResolvedValue(undefined)
    refreshAppConfigMock.mockResolvedValue(buildAppConfigReturn().config)

    render(<OptionsBar fileIds={[]} onTasksCreated={() => {}} />)

    fireEvent.click(document.querySelector('#reset-engine-defaults') as HTMLButtonElement)

    await waitFor(() => {
      expect(deleteTranscriptionDefaultsMock).toHaveBeenCalledTimes(1)
      expect(resetOptionOverrides).toHaveBeenCalledTimes(1)
      expect(refreshAppConfigMock).toHaveBeenCalledTimes(1)
      expect(toastSuccessMock).toHaveBeenCalledWith('options.defaults.resetDone')
    })
  })

  it('shows an error toast when resetting defaults fails', async () => {
    const resetOptionOverrides = vi.fn()
    useTranscriptionOptionsMock.mockReturnValue(
      buildHookReturn({
        defaults: buildDefaults({
          language: 'ja',
          task: 'translate',
          beam_size: 3,
        }),
        resetOptionOverrides,
      }),
    )
    deleteTranscriptionDefaultsMock.mockRejectedValue(new Error('boom'))

    render(<OptionsBar fileIds={[]} onTasksCreated={() => {}} />)

    fireEvent.click(document.querySelector('#reset-engine-defaults') as HTMLButtonElement)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('error.api.serverError')
    })
    expect(refreshAppConfigMock).not.toHaveBeenCalled()
    expect(resetOptionOverrides).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })
})
