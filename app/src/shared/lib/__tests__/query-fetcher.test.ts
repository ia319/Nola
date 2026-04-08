import { describe, expect, it, vi } from 'vitest'

import { queryFetcher } from '@/shared/lib/query-fetcher'

const apiClientMocks = vi.hoisted(() => ({
  request: vi.fn(),
}))

vi.mock('@/shared/lib/api-client', () => ({
  default: {
    request: apiClientMocks.request,
  },
}))

describe('queryFetcher', () => {
  it('forwards request options to the shared api client and returns response data', async () => {
    const signal = new AbortController().signal
    const responseData = { items: [{ id: 'task-1' }] }

    apiClientMocks.request.mockResolvedValueOnce({ data: responseData })

    await expect(
      queryFetcher<typeof responseData, { limit: number }>({
        path: '/api/transcription-tasks/',
        params: { limit: 20 },
        signal,
      }),
    ).resolves.toEqual(responseData)

    expect(apiClientMocks.request).toHaveBeenCalledWith({
      url: '/api/transcription-tasks/',
      method: 'GET',
      params: { limit: 20 },
      data: undefined,
      signal,
    })
  })
})
