import { afterEach, describe, expect, it, vi } from 'vitest'

import logger from '@/config/logger'

import { requestTaskRefresh, subscribeTaskRefresh } from '../task-refresh'

vi.mock('@/config/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const loggerErrorMock = vi.mocked(logger.error)

afterEach(() => {
  vi.clearAllMocks()
})

describe('task refresh', () => {
  it('continues fan-out when one listener throws', () => {
    const throwingListener = vi.fn(() => {
      throw new Error('listener failed')
    })
    const healthyListener = vi.fn()

    const unsubscribeThrowing = subscribeTaskRefresh(throwingListener)
    const unsubscribeHealthy = subscribeTaskRefresh(healthyListener)

    try {
      expect(() => requestTaskRefresh()).not.toThrow()
      expect(throwingListener).toHaveBeenCalledTimes(1)
      expect(healthyListener).toHaveBeenCalledTimes(1)
      expect(loggerErrorMock).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribeThrowing()
      unsubscribeHealthy()
    }
  })
})
