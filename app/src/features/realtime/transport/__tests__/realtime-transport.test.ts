import { describe, expect, it } from 'vitest'

import { createRealtimeTransport } from '../realtime-transport'
import { WebLiveRealtimeTransport } from '../web-realtime-transport'

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  binaryType: BinaryType = 'blob'
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  send(_data: Parameters<WebSocket['send']>[0]): void {}

  close(_code?: number, _reason?: string): void {
    this.readyState = FakeWebSocket.CLOSED
  }
}

describe('createRealtimeTransport', () => {
  it('creates the web transport for the web runtime', async () => {
    await expect(
      createRealtimeTransport({
        environment: 'web',
        WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      }),
    ).resolves.toBeInstanceOf(WebLiveRealtimeTransport)
  })

  it('reuses the web transport for the tauri runtime', async () => {
    await expect(
      createRealtimeTransport({
        environment: 'tauri',
        WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      }),
    ).resolves.toBeInstanceOf(WebLiveRealtimeTransport)
  })

  it('allows tauri web transport teardown before connection', async () => {
    const transport = await createRealtimeTransport({
      environment: 'tauri',
      WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    })

    expect(() => transport.disconnect()).not.toThrow()
    expect(() => transport.close()).not.toThrow()
  })
})
