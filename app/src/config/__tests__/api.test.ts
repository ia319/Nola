import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteTranscriptionDefaults,
  fetchAppConfig,
  fetchEngineDefaults,
  fetchSessionDefaults,
  patchSessionDefaults,
  patchTranscriptionDefaults,
} from '../api'

const apiClientMocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/shared/lib/api-client', () => ({
  default: {
    get: apiClientMocks.get,
    patch: apiClientMocks.patch,
    delete: apiClientMocks.delete,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('config api', () => {
  it('fetches config endpoints with AbortSignal support', async () => {
    const signal = new AbortController().signal
    apiClientMocks.get.mockResolvedValueOnce({ data: { file: {} } })
    apiClientMocks.get.mockResolvedValueOnce({ data: { defaults: {} } })
    apiClientMocks.get.mockResolvedValueOnce({ data: { execution: {}, transcription: {} } })

    await fetchAppConfig(signal)
    await fetchEngineDefaults(signal)
    await fetchSessionDefaults(signal)

    expect(apiClientMocks.get).toHaveBeenNthCalledWith(1, '/api/config', { signal })
    expect(apiClientMocks.get).toHaveBeenNthCalledWith(
      2,
      '/api/config/transcription/engine-defaults',
      { signal },
    )
    expect(apiClientMocks.get).toHaveBeenNthCalledWith(3, '/api/config/session-defaults', {
      signal,
    })
  })

  it('writes transcription and session defaults through config endpoints', async () => {
    apiClientMocks.patch.mockResolvedValue({ data: { defaults: {} } })

    await patchTranscriptionDefaults({ beam_size: 3 })
    await patchSessionDefaults({
      execution: {
        model_id: 'large-v3',
        device: 'cuda',
        compute_type: 'float16',
      },
      transcription: {
        beam_size: 7,
      },
    })

    expect(apiClientMocks.patch).toHaveBeenNthCalledWith(1, '/api/config/transcription/defaults', {
      beam_size: 3,
    })
    expect(apiClientMocks.patch).toHaveBeenNthCalledWith(2, '/api/config/session-defaults', {
      execution: {
        model_id: 'large-v3',
        device: 'cuda',
        compute_type: 'float16',
      },
      transcription: {
        beam_size: 7,
      },
    })
  })

  it('deletes transcription defaults through the reset endpoint', async () => {
    apiClientMocks.delete.mockResolvedValue({ data: undefined })

    await deleteTranscriptionDefaults()

    expect(apiClientMocks.delete).toHaveBeenCalledWith('/api/config/transcription/defaults')
  })
})
