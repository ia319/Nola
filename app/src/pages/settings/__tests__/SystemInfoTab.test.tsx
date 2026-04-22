// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const systemInfoMocks = vi.hoisted(() => ({
  checkIntegrityMock: vi.fn(),
  cleanupOrphansMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => {
      const messages: Record<string, string> = {
        'settings.systemInfo.sections.architecture.label': 'System Architecture',
        'settings.systemInfo.sections.integrity.label': 'File Integrity',
        'settings.systemInfo.sections.maintenance.label': 'Maintenance',
        'settings.systemInfo.fields.runtimeBoundary.label': 'Runtime Boundary',
        'settings.systemInfo.fields.runtimeBoundary.description': 'Run local API.',
        'settings.systemInfo.fields.fileIndex.label': 'File Index',
        'settings.systemInfo.fields.fileIndex.description': 'Check database and disk.',
        'settings.systemInfo.fields.modelStorage.label': 'Model Storage',
        'settings.systemInfo.fields.modelStorage.description': 'Use model storage page.',
        'settings.systemInfo.fields.integrityCheck.label': 'Integrity Check',
        'settings.systemInfo.fields.integrityCheck.description': 'Check missing files.',
        'settings.systemInfo.fields.cleanupOrphans.label': 'Cleanup Orphans',
        'settings.systemInfo.fields.cleanupOrphans.description': 'Delete orphaned records.',
        'settings.systemInfo.values.localApi': 'Local API service',
        'settings.systemInfo.values.databaseAndDisk': 'Database records + disk files',
        'settings.systemInfo.values.separateSettingsPage': 'Model Storage page',
        'settings.systemInfo.values.notChecked': 'Not checked',
        'settings.systemInfo.values.checking': 'Checking...',
        'settings.systemInfo.values.clean': 'No missing files',
        'settings.systemInfo.values.cleanupReady': 'Ready after integrity check',
        'settings.systemInfo.values.cleanupBlocked': 'Run integrity check first',
        'settings.systemInfo.actions.check': 'Check',
        'settings.systemInfo.actions.checking': 'Checking...',
        'settings.systemInfo.actions.cleanup': 'Cleanup',
        'settings.systemInfo.actions.cleaning': 'Cleaning...',
        'settings.systemInfo.actions.cancel': 'Cancel',
        'settings.systemInfo.actions.confirmCleanup': 'Cleanup Orphans',
        'settings.systemInfo.confirm.title': 'Cleanup orphan records?',
        'settings.systemInfo.confirm.description': 'Delete missing file records.',
        'settings.systemInfo.toast.integrityChecked': 'File integrity checked',
        'settings.systemInfo.toast.cleanupDone': 'Orphan records cleaned up',
      }

      if (key === 'settings.systemInfo.values.missingCount') {
        return `${String(params?.count)} missing file(s)`
      }

      if (key === 'settings.systemInfo.values.deletedCount') {
        return `${String(params?.count)} orphan record(s) deleted`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: systemInfoMocks.toastSuccessMock,
    error: systemInfoMocks.toastErrorMock,
  },
}))

vi.mock('@/config/logger', () => ({
  default: {
    error: systemInfoMocks.loggerErrorMock,
  },
}))

vi.mock('@/features/upload/api', () => ({
  checkIntegrity: systemInfoMocks.checkIntegrityMock,
  cleanupOrphans: systemInfoMocks.cleanupOrphansMock,
}))

import { SystemInfoTab } from '../SystemInfoTab'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderSystemInfoTab(queryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SystemInfoTab />
    </QueryClientProvider>,
  )
}

describe('SystemInfoTab', () => {
  beforeEach(() => {
    systemInfoMocks.checkIntegrityMock.mockReset()
    systemInfoMocks.cleanupOrphansMock.mockReset()
    systemInfoMocks.toastSuccessMock.mockReset()
    systemInfoMocks.toastErrorMock.mockReset()
    systemInfoMocks.loggerErrorMock.mockReset()
    systemInfoMocks.checkIntegrityMock.mockResolvedValue({
      status: 'ok',
      missing_files: [],
      missing_count: 0,
    })
    systemInfoMocks.cleanupOrphansMock.mockResolvedValue({
      message: 'ok',
      deleted_count: 1,
      deleted_files: [{ id: 'file-1', filename: 'audio.wav', path: 'C:/secret/audio.wav' }],
    })
  })

  it('renders read-only system architecture and blocked maintenance state', () => {
    renderSystemInfoTab()

    expect(screen.getByText('System Architecture')).toBeTruthy()
    expect(screen.getByText('Local API service')).toBeTruthy()
    expect(screen.getByText('Database records + disk files')).toBeTruthy()
    expect(screen.getByText('Model Storage page')).toBeTruthy()
    expect(screen.getByText('Not checked')).toBeTruthy()
    expect(screen.getByText('Run integrity check first')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cleanup' })).toBeDisabled()
  })

  it('checks integrity, hides missing file paths, and confirms orphan cleanup', async () => {
    systemInfoMocks.checkIntegrityMock.mockResolvedValueOnce({
      status: 'missing',
      missing_count: 1,
      missing_files: [{ id: 'file-1', filename: 'audio.wav', path: 'C:/secret/audio.wav' }],
    })

    renderSystemInfoTab()

    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    await waitFor(() => {
      expect(screen.getByText('1 missing file(s)')).toBeTruthy()
    })

    expect(screen.getByText('audio.wav')).toBeTruthy()
    expect(screen.getByText('file-1')).toBeTruthy()
    expect(screen.queryByText('C:/secret/audio.wav')).toBeNull()
    expect(systemInfoMocks.toastSuccessMock).toHaveBeenCalledWith('File integrity checked')

    fireEvent.click(screen.getByRole('button', { name: 'Cleanup' }))
    expect(screen.getByText('Cleanup orphan records?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cleanup Orphans' }))

    await waitFor(() => {
      expect(systemInfoMocks.cleanupOrphansMock).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('1 orphan record(s) deleted')).toBeTruthy()
    await waitFor(() => {
      expect(systemInfoMocks.toastSuccessMock).toHaveBeenCalledWith('Orphan records cleaned up')
    })
  })
})
