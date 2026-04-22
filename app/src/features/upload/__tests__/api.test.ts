import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkIntegrity, cleanupOrphans } from '../api'

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
  it('uses file maintenance endpoints', async () => {
    apiClientMocks.get.mockResolvedValueOnce({ data: { missing_count: 0 } })
    apiClientMocks.post.mockResolvedValueOnce({ data: { deleted_count: 0 } })

    await checkIntegrity()
    await cleanupOrphans()

    expect(apiClientMocks.get).toHaveBeenCalledWith('/api/files/check-integrity')
    expect(apiClientMocks.post).toHaveBeenCalledWith('/api/files/cleanup')
  })
})
