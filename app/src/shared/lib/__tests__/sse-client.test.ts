import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createExternalLocalConnectionProfile } from '@/config/connection/profile'
import {
  resetActiveConnectionProfile,
  setActiveConnectionProfile,
} from '@/config/connection/runtime'
import { createSSEConnection } from '../sse-client'

class FakeEventSource {
  static lastInstance: FakeEventSource | null = null

  url: string
  closed = false
  private listeners = new Map<string, Array<(event: Event) => void>>()

  constructor(url: string) {
    this.url = url
    FakeEventSource.lastInstance = this
  }

  addEventListener(name: string, handler: (event: Event) => void): void {
    const current = this.listeners.get(name) ?? []
    current.push(handler)
    this.listeners.set(name, current)
  }

  close(): void {
    this.closed = true
  }

  emit(name: string, event: Event): void {
    for (const handler of this.listeners.get(name) ?? []) {
      handler(event)
    }
  }
}

beforeEach(() => {
  FakeEventSource.lastInstance = null
  resetActiveConnectionProfile('web')
  setActiveConnectionProfile(
    createExternalLocalConnectionProfile('http://127.0.0.1:8000', 'user-config'),
  )
  vi.unstubAllGlobals()
  vi.stubGlobal('EventSource', FakeEventSource)
})

describe('createSSEConnection', () => {
  it('opens a connection, parses JSON payloads, and closes on cleanup', () => {
    const onMessage = vi.fn()
    const onOpen = vi.fn()
    const onError = vi.fn()

    const cleanup = createSSEConnection('/api/models/events', {
      eventNames: ['progress'],
      onMessage,
      onOpen,
      onError,
    })

    const source = FakeEventSource.lastInstance
    expect(source?.url).toBe('http://127.0.0.1:8000/api/models/events')

    source?.emit(
      'progress',
      new MessageEvent('progress', {
        data: JSON.stringify({ model_id: 'small', percent: 50 }),
      }),
    )
    source?.emit('progress', new MessageEvent('progress', { data: '{bad json' }))
    source?.emit('open', new Event('open'))
    source?.emit('error', new Event('error'))

    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith({
      event: 'progress',
      data: { model_id: 'small', percent: 50 },
    })
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)

    cleanup()

    expect(source?.closed).toBe(true)
  })

  it('defaults to the message event when no eventNames are provided', () => {
    const onMessage = vi.fn()

    createSSEConnection('/api/models/events', { onMessage })

    const source = FakeEventSource.lastInstance
    source?.emit('message', new MessageEvent('message', { data: JSON.stringify({ ok: true }) }))

    expect(onMessage).toHaveBeenCalledWith({
      event: 'message',
      data: { ok: true },
    })
  })
})
