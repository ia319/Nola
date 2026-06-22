// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CONNECTION_CONFIG_VERSION } from '@/config/connection/config'
import { createDesktopGatewayRemoteConnectionProfile } from '@/config/connection/profile'
import { MemoryConnectionConfigRepository } from '@/config/connection/storage'
import {
  resetActiveConnectionProfile,
  setActiveConnectionProfile,
} from '@/config/connection/runtime'

const connectionTabMocks = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  t: (key: string) => {
    const messages: Record<string, string> = {
      'settings.connection.loading': 'Loading connection settings...',
      'settings.connection.sections.target.label': 'Connection Target',
      'settings.connection.modes.externalLocal.label': 'Local backend',
      'settings.connection.modes.externalLocal.description': 'Use the local API.',
      'settings.connection.modes.remote.label': 'Remote backend',
      'settings.connection.modes.remote.description': 'Use a remote Nola Node.',
      'settings.connection.fields.mode.label': 'Backend Mode',
      'settings.connection.fields.mode.description': 'Choose the backend.',
      'settings.connection.fields.backendUrl.label': 'Backend URL',
      'settings.connection.fields.backendUrl.localDescription': 'Use local loopback.',
      'settings.connection.fields.backendUrl.remoteDescription': 'Use a HTTPS origin.',
      'settings.connection.fields.backendUrl.placeholder': 'https://nola.example.com',
      'settings.connection.fields.backendUrl.localHint': 'Start the local API separately.',
      'settings.connection.fields.status.label': 'Connection Status',
      'settings.connection.fields.status.description': 'Check the backend.',
      'settings.connection.status.not-checked': 'Not checked',
      'settings.connection.status.unconfigured': 'Not configured',
      'settings.connection.status.checking': 'Checking...',
      'settings.connection.status.available': 'Available',
      'settings.connection.status.unreachable': 'Unreachable',
      'settings.connection.status.api-unavailable': 'API unavailable',
      'settings.connection.status.cors-blocked': 'CORS blocked',
      'settings.connection.status.csp-blocked': 'Desktop policy blocked',
      'settings.connection.status.realtime-failed': 'Realtime channel failed',
      'settings.connection.remoteNotice.title': 'Remote realtime sends local audio',
      'settings.connection.remoteNotice.description': 'Audio is sent to the remote URL.',
      'settings.connection.warnings.title': 'Connection diagnostics',
      'settings.connection.warnings.invalidManagedLocalRuntimeOrigin':
        'Managed local override ignored.',
      'settings.connection.warnings.invalidBackendRuntimeUrl': 'Runtime backend URL ignored.',
      'settings.connection.warnings.invalidDesktopGatewayRuntimeOrigin': 'Gateway origin ignored.',
      'settings.connection.warnings.desktopCoreSidecarUnavailable':
        'Bundled local backend unavailable.',
      'settings.connection.warnings.desktopCoreSidecarDegraded': 'Bundled worker unavailable.',
      'settings.connection.errors.title': 'Connection setting failed',
      'settings.connection.errors.load': 'Connection settings could not be loaded.',
      'settings.connection.errors.save': 'Connection settings could not be saved.',
      'settings.connection.errors.reset': 'Connection settings could not be reset.',
      'settings.connection.errors.check': 'Connection health check failed.',
      'settings.connection.actions.reset': 'Reset',
      'settings.connection.actions.resetting': 'Resetting...',
      'settings.connection.actions.check': 'Check',
      'settings.connection.actions.checking': 'Checking...',
      'settings.connection.actions.save': 'Save Changes',
      'settings.connection.actions.saving': 'Saving...',
      'settings.connection.toast.saved': 'Connection settings updated',
      'settings.connection.toast.reset': 'Connection settings reset',
    }

    return messages[key] ?? key
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: connectionTabMocks.t,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: connectionTabMocks.toastSuccessMock,
  },
}))

import { ConnectionTab } from '../ConnectionTab'

function createOkResponse(): Response {
  return new Response('{}', { status: 200 })
}

function renderTauriConnectionTab(
  repository = new MemoryConnectionConfigRepository(),
): MemoryConnectionConfigRepository {
  resetActiveConnectionProfile('tauri')
  render(<ConnectionTab environment="tauri" repository={repository} />)
  return repository
}

describe('ConnectionTab', () => {
  beforeEach(() => {
    connectionTabMocks.toastSuccessMock.mockReset()
    resetActiveConnectionProfile('web')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetActiveConnectionProfile('web')
  })

  it('renders local mode with a read-only loopback URL', async () => {
    renderTauriConnectionTab()

    await waitFor(() => {
      expect(screen.getByText('Connection Target')).toBeTruthy()
    })

    expect(screen.getByRole('radio', { name: /Local backend/ })).toBeChecked()
    expect(screen.getByLabelText('Backend URL')).toHaveValue('http://127.0.0.1:8000')
    expect(screen.getByLabelText('Backend URL')).toBeDisabled()
    expect(screen.getByText('Not checked')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  it('allows desktop users to configure a remote backend target', async () => {
    renderTauriConnectionTab()

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Remote backend/ })).toBeTruthy()
    })

    expect(screen.getByRole('radio', { name: /Remote backend/ })).not.toBeDisabled()
  })

  it('validates and saves a remote HTTPS backend URL for web clients', async () => {
    const repository = new MemoryConnectionConfigRepository()
    render(<ConnectionTab environment="web" repository={repository} />)

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Remote backend/ })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('radio', { name: /Remote backend/ }))
    fireEvent.change(screen.getByLabelText('Backend URL'), {
      target: { value: 'http://nola.example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(screen.getByText('Connection setting failed')).toBeTruthy()
    })
    expect(screen.getByText('Remote backend URL must use https://')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Backend URL'), {
      target: { value: 'https://nola.example.com/' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(async () => {
      await expect(repository.load()).resolves.toEqual({
        version: CONNECTION_CONFIG_VERSION,
        mode: 'remote',
        httpOrigin: 'https://nola.example.com',
      })
    })
    expect(connectionTabMocks.toastSuccessMock).toHaveBeenCalledWith('Connection settings updated')
  })

  it('checks health and API config through the selected backend', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createOkResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderTauriConnectionTab()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    await waitFor(() => {
      expect(screen.getByText('Available')).toBeTruthy()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/health',
      expect.objectContaining({
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/config',
      expect.objectContaining({
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('checks saved desktop remote targets through the active gateway profile', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createOkResponse())
    const targetOrigin = 'https://nola.example.com'
    const gatewayOrigin = 'http://127.0.0.1:31000'
    const repository = new MemoryConnectionConfigRepository({
      version: CONNECTION_CONFIG_VERSION,
      mode: 'remote',
      httpOrigin: targetOrigin,
    })
    setActiveConnectionProfile(
      createDesktopGatewayRemoteConnectionProfile(targetOrigin, gatewayOrigin, 'user-config'),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ConnectionTab environment="tauri" repository={repository} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy()
    })

    expect(screen.getByLabelText('Backend URL')).toHaveValue(targetOrigin)

    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    await waitFor(() => {
      expect(screen.getByText('Available')).toBeTruthy()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `${gatewayOrigin}/health`,
      expect.objectContaining({
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      `${gatewayOrigin}/api/config`,
      expect.objectContaining({
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('reports API unavailable when health passes but config fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createOkResponse())
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    renderTauriConnectionTab()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    await waitFor(() => {
      expect(screen.getByText('API unavailable')).toBeTruthy()
    })
  })
})
