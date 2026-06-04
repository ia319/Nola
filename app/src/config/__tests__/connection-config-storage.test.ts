// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { CONNECTION_CONFIG_STORAGE_KEY, CONNECTION_CONFIG_VERSION } from '../connection-config'
import {
  BrowserConnectionConfigRepository,
  createConnectionConfigRepository,
  DesktopConnectionConfigRepository,
  MemoryConnectionConfigRepository,
} from '../connection-config-storage'

const loadDesktopConnectionConfigMock = vi.hoisted(() => vi.fn())
const saveDesktopConnectionConfigMock = vi.hoisted(() => vi.fn())
const clearDesktopConnectionConfigMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/tauri-api', () => ({
  loadDesktopConnectionConfig: loadDesktopConnectionConfigMock,
  saveDesktopConnectionConfig: saveDesktopConnectionConfigMock,
  clearDesktopConnectionConfig: clearDesktopConnectionConfigMock,
}))

describe('connection config repositories', () => {
  afterEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('stores browser connection config in localStorage', async () => {
    const repository = new BrowserConnectionConfigRepository()

    await repository.save({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com/',
    })

    expect(window.localStorage.getItem(CONNECTION_CONFIG_STORAGE_KEY)).toBe(
      JSON.stringify({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
      }),
    )
    await expect(repository.load()).resolves.toEqual({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
    })

    await repository.clear()
    await expect(repository.load()).resolves.toBeNull()
  })

  it('returns null for corrupt browser config payloads', async () => {
    window.localStorage.setItem(CONNECTION_CONFIG_STORAGE_KEY, '{')
    const repository = new BrowserConnectionConfigRepository()

    await expect(repository.load()).resolves.toBeNull()
  })

  it('loads desktop connection config through Tauri storage commands', async () => {
    loadDesktopConnectionConfigMock.mockResolvedValueOnce(
      JSON.stringify({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'external-local',
        httpOrigin: 'http://localhost:8123/',
      }),
    )

    const repository = new DesktopConnectionConfigRepository()

    await expect(repository.load()).resolves.toEqual({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'external-local',
      httpOrigin: 'http://localhost:8123',
    })
    expect(loadDesktopConnectionConfigMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to null when desktop config cannot be loaded', async () => {
    loadDesktopConnectionConfigMock.mockRejectedValueOnce(new Error('permission denied'))
    const repository = new DesktopConnectionConfigRepository()

    await expect(repository.load()).resolves.toBeNull()
  })

  it('saves and clears desktop connection config through Tauri storage commands', async () => {
    saveDesktopConnectionConfigMock.mockResolvedValueOnce(undefined)
    clearDesktopConnectionConfigMock.mockResolvedValueOnce(undefined)

    const repository = new DesktopConnectionConfigRepository()
    await repository.save({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com/',
    })
    await repository.clear()

    expect(saveDesktopConnectionConfigMock).toHaveBeenCalledWith(
      JSON.stringify({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
      }),
    )
    expect(clearDesktopConnectionConfigMock).toHaveBeenCalledTimes(1)
  })

  it('normalizes and clears memory repository state for tests', async () => {
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com/',
    })

    await expect(repository.load()).resolves.toEqual({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: 'https://nola.example.com',
    })
    await repository.clear()
    await expect(repository.load()).resolves.toBeNull()
  })

  it('selects repository implementations by runtime environment', () => {
    expect(createConnectionConfigRepository('web')).toBeInstanceOf(
      BrowserConnectionConfigRepository,
    )
    expect(createConnectionConfigRepository('tauri')).toBeInstanceOf(
      DesktopConnectionConfigRepository,
    )
  })
})
