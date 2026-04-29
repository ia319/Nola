import { beforeEach, describe, expect, it, vi } from 'vitest'

import { batchDeleteFiles, checkIntegrity, cleanupOrphans, listFiles } from '../api'

const apiClientMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/lib/api-client', () => ({
  default: {
    get: apiClientMocks.get,
    post: apiClientMocks.post,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('upload api', () => {
  it('lists files with query, filter, sort, and pagination params', async () => {
    apiClientMocks.get.mockResolvedValueOnce({ data: { files: [], total: 0 } })
    const signal = new AbortController().signal

    await listFiles(
      {
        q: 'meeting',
        content_type: 'audio/wav',
        sort_by: 'filename',
        order: 'asc',
        limit: 20,
        offset: 40,
      },
      signal,
    )

    expect(apiClientMocks.get).toHaveBeenCalledWith('/api/files/', {
      params: {
        q: 'meeting',
        content_type: 'audio/wav',
        sort_by: 'filename',
        order: 'asc',
        limit: 20,
        offset: 40,
      },
      signal,
    })
  })

  it('calls batch delete files endpoint with file_ids body', async () => {
    apiClientMocks.post.mockResolvedValueOnce({ data: { action: 'delete', results: [] } })

    await batchDeleteFiles(['file-1', 'file-2'])

    expect(apiClientMocks.post).toHaveBeenCalledWith('/api/files/batch/delete', {
      file_ids: ['file-1', 'file-2'],
    })
  })

  it('uses file maintenance endpoints', async () => {
    apiClientMocks.get.mockResolvedValueOnce({ data: { missing_count: 0 } })
    apiClientMocks.post.mockResolvedValueOnce({ data: { deleted_count: 0 } })

    await checkIntegrity()
    await cleanupOrphans()

    expect(apiClientMocks.get).toHaveBeenCalledWith('/api/files/check-integrity')
    expect(apiClientMocks.post).toHaveBeenCalledWith('/api/files/cleanup')
  })
})
