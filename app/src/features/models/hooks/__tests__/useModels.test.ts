// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listModels } from '../../api'
import { requestModelRefresh } from '../../lib/model-refresh'
import { useModels } from '../useModels'

vi.mock('../../api', () => ({
  listModels: vi.fn(),
}))

const listModelsMock = vi.mocked(listModels)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useModels', () => {
  it('loads model list state on mount', async () => {
    listModelsMock.mockResolvedValue({
      models: [
        {
          model_id: 'small',
          name: 'Small',
          size_bytes: 1_000,
          repo_id: 'Systran/faster-whisper-small',
          languages: 'multilingual',
          speed_rank: 2,
          accuracy_rank: 2,
          description: 'Small model',
          description_key: 'models.catalog.small.description',
          status: 'downloaded',
          disk_usage: 1_000,
          is_configured: true,
          is_last_loaded: true,
          download_progress: null,
        },
      ],
      configured_model_id: 'small',
      last_loaded_model_id: 'small',
      effective_model_dir: 'D:/models',
    })

    const { result } = renderHook(() => useModels())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(listModelsMock).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(result.current.models.map((model) => model.model_id)).toEqual(['small'])
    expect(result.current.configuredModelId).toBe('small')
    expect(result.current.lastLoadedModelId).toBe('small')
    expect(result.current.effectiveModelDir).toBe('D:/models')
    expect(result.current.error).toBeNull()
    expect(result.current.hasLoaded).toBe(true)
    expect(result.current.isRefreshing).toBe(false)
  })

  it('preserves AppError semantics when requests fail', async () => {
    const appError = {
      code: 'API_CLIENT_409',
      i18nKey: 'error.api.clientError',
      params: { status: 409, detail: 'busy' },
      retriable: false,
    }
    listModelsMock.mockRejectedValue(appError)

    const { result } = renderHook(() => useModels())

    await waitFor(() => {
      expect(result.current.error).toEqual(appError)
    })

    expect(result.current.models).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoaded).toBe(false)
  })

  it('refreshes the list in the background when data already exists', async () => {
    let resolveRefresh:
      | ((value: {
          models: []
          configured_model_id: 'large-v3'
          last_loaded_model_id: 'large-v3'
          effective_model_dir: 'D:/models-b'
        }) => void)
      | null = null

    listModelsMock
      .mockResolvedValueOnce({
        models: [],
        configured_model_id: null,
        last_loaded_model_id: null,
        effective_model_dir: 'D:/models-a',
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve
          }),
      )

    const { result } = renderHook(() => useModels())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let refreshPromise: Promise<void> | null = null
    act(() => {
      refreshPromise = result.current.refresh()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isRefreshing).toBe(true)

    await act(async () => {
      resolveRefresh?.({
        models: [],
        configured_model_id: 'large-v3',
        last_loaded_model_id: 'large-v3',
        effective_model_dir: 'D:/models-b',
      })
      await refreshPromise
    })

    expect(listModelsMock).toHaveBeenCalledTimes(2)
    expect(result.current.configuredModelId).toBe('large-v3')
    expect(result.current.effectiveModelDir).toBe('D:/models-b')
    expect(result.current.isRefreshing).toBe(false)
  })

  it('refreshes when the global model refresh event fires', async () => {
    listModelsMock
      .mockResolvedValueOnce({
        models: [],
        configured_model_id: null,
        last_loaded_model_id: null,
        effective_model_dir: 'D:/models-a',
      })
      .mockResolvedValueOnce({
        models: [],
        configured_model_id: 'small',
        last_loaded_model_id: 'small',
        effective_model_dir: 'D:/models-b',
      })

    const { result } = renderHook(() => useModels())

    await waitFor(() => {
      expect(result.current.effectiveModelDir).toBe('D:/models-a')
    })

    await act(async () => {
      requestModelRefresh()
    })

    await waitFor(() => {
      expect(result.current.effectiveModelDir).toBe('D:/models-b')
    })

    expect(listModelsMock).toHaveBeenCalledTimes(2)
  })
})
