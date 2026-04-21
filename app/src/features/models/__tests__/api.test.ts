import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cancelDownload,
  deleteModel,
  getModelDetail,
  getModelSettings,
  listActiveModelDownloads,
  listModels,
  patchModelSettings,
  selectModel,
  startDownload,
} from '../api'

const apiClientMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('@/shared/lib/api-client', () => ({
  default: {
    get: apiClientMocks.get,
    post: apiClientMocks.post,
    delete: apiClientMocks.delete,
    patch: apiClientMocks.patch,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('models api', () => {
  it('uses list, detail, and settings endpoints with AbortSignal support', async () => {
    const signal = new AbortController().signal
    apiClientMocks.get.mockResolvedValueOnce({ data: { models: [] } })
    apiClientMocks.get.mockResolvedValueOnce({ data: { model_id: 'small' } })
    apiClientMocks.get.mockResolvedValueOnce({ data: { effective_model_dir: 'D:/models' } })
    apiClientMocks.get.mockResolvedValueOnce({ data: { downloads: [] } })

    await listModels(signal)
    await getModelDetail('small', signal)
    await getModelSettings(signal)
    await listActiveModelDownloads(signal)

    expect(apiClientMocks.get).toHaveBeenNthCalledWith(1, '/api/models', { signal })
    expect(apiClientMocks.get).toHaveBeenNthCalledWith(2, '/api/models/small', { signal })
    expect(apiClientMocks.get).toHaveBeenNthCalledWith(3, '/api/models/settings', { signal })
    expect(apiClientMocks.get).toHaveBeenNthCalledWith(4, '/api/models/downloads', { signal })
  })

  it('uses model mutation endpoints', async () => {
    apiClientMocks.post.mockResolvedValue({ data: {} })
    apiClientMocks.delete.mockResolvedValue({ data: {} })
    apiClientMocks.patch.mockResolvedValue({ data: {} })

    await startDownload('small')
    await cancelDownload('small')
    await selectModel('small')
    await deleteModel('small')
    await patchModelSettings({ configured_model_dir: 'D:/models' })

    expect(apiClientMocks.post).toHaveBeenNthCalledWith(1, '/api/models/small/download')
    expect(apiClientMocks.post).toHaveBeenNthCalledWith(2, '/api/models/small/cancel')
    expect(apiClientMocks.post).toHaveBeenNthCalledWith(3, '/api/models/small/select')
    expect(apiClientMocks.delete).toHaveBeenCalledWith('/api/models/small')
    expect(apiClientMocks.patch).toHaveBeenCalledWith('/api/models/settings', {
      configured_model_dir: 'D:/models',
    })
  })
})
