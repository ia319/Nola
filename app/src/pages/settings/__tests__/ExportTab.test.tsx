// @vitest-environment jsdom

import { createElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const exportTabMocks = vi.hoisted(() => ({
  fetchExportConfigMock: vi.fn(),
  patchExportDefaultsMock: vi.fn(),
  deleteExportDefaultsMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => {
      const messages: Record<string, string> = {
        'settings.export.loading': 'Loading export defaults...',
        'settings.export.unavailable': 'Export defaults are not available.',
        'settings.export.sections.defaults.label': 'Export Defaults',
        'settings.export.sections.future.label': 'Planned Capabilities',
        'settings.export.fields.format.label': 'Default Export Format',
        'settings.export.fields.format.description':
          'Choose the file format used by one-click and batch exports.',
        'settings.export.fields.includeTimestamps.label': 'Include Timestamps for TXT',
        'settings.export.fields.includeTimestamps.description': 'Add time prefixes to TXT exports.',
        'settings.export.fields.futureFormats.label': 'Future Formats',
        'settings.export.fields.futureFormats.description': 'Keep future formats visible.',
        'settings.export.fields.metadata.label': 'Metadata Inclusion',
        'settings.export.fields.metadata.description': 'Wait for backend support.',
        'settings.export.fields.archivePath.label': 'Archive Path',
        'settings.export.fields.archivePath.description': 'Review the archive location.',
        'settings.export.formats.srt.label': 'SubRip (.srt)',
        'settings.export.formats.srt.detail': 'Use the common subtitle format.',
        'settings.export.formats.vtt.label': 'WebVTT (.vtt)',
        'settings.export.formats.vtt.detail': 'Use the web subtitle format.',
        'settings.export.formats.txt.label': 'Plain Text (.txt)',
        'settings.export.formats.txt.detail': 'Use a readable transcript file.',
        'settings.export.formats.ass.label': 'Advanced SubStation Alpha (.ass)',
        'settings.export.formats.ass.detail': 'Use the styled subtitle format.',
        'settings.export.values.comingSoon': 'Coming soon',
        'settings.export.values.unavailable': 'Not exposed',
        'settings.export.actions.retry': 'Retry',
        'settings.export.actions.reset': 'Reset to Defaults',
        'settings.export.actions.resetting': 'Resetting...',
        'settings.export.actions.save': 'Save Changes',
        'settings.export.actions.saving': 'Saving...',
        'settings.export.toast.saved': 'Export defaults updated',
        'settings.export.toast.reset': 'Export defaults reset',
      }

      if (key === 'settings.export.values.futureFormat') {
        return `${String(params?.format)} coming soon`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: exportTabMocks.toastSuccessMock,
    error: exportTabMocks.toastErrorMock,
  },
}))

vi.mock('@/config/logger', () => ({
  default: {
    error: exportTabMocks.loggerErrorMock,
    warn: exportTabMocks.loggerWarnMock,
  },
}))

vi.mock('@/features/export/api', () => ({
  fetchExportConfig: exportTabMocks.fetchExportConfigMock,
  patchExportDefaults: exportTabMocks.patchExportDefaultsMock,
  deleteExportDefaults: exportTabMocks.deleteExportDefaultsMock,
}))

import { ExportTab } from '../ExportTab'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderExportTab(queryClient = createQueryClient()) {
  return render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(ExportTab)),
  )
}

describe('ExportTab', () => {
  beforeEach(() => {
    exportTabMocks.fetchExportConfigMock.mockReset()
    exportTabMocks.patchExportDefaultsMock.mockReset()
    exportTabMocks.deleteExportDefaultsMock.mockReset()
    exportTabMocks.toastSuccessMock.mockReset()
    exportTabMocks.toastErrorMock.mockReset()
    exportTabMocks.loggerErrorMock.mockReset()
    exportTabMocks.loggerWarnMock.mockReset()

    exportTabMocks.fetchExportConfigMock.mockResolvedValue({
      defaults: {
        format: 'srt',
        include_timestamps: true,
      },
    })
    exportTabMocks.patchExportDefaultsMock.mockResolvedValue({
      defaults: {
        format: 'txt',
        include_timestamps: false,
      },
    })
    exportTabMocks.deleteExportDefaultsMock.mockResolvedValue(undefined)
  })

  it('renders writable export defaults and read-only future capability rows', async () => {
    renderExportTab()

    await waitFor(() => {
      expect(screen.getByText('Export Defaults')).toBeTruthy()
    })

    expect(screen.getByLabelText('Default Export Format')).toHaveValue('srt')
    expect(screen.getByRole('switch', { name: 'Include Timestamps for TXT' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByText('Future Formats')).toBeTruthy()
    expect(screen.getByText('JSON coming soon')).toBeTruthy()
    expect(screen.getByText('TSV coming soon')).toBeTruthy()
    expect(screen.getByText('Metadata Inclusion')).toBeTruthy()
    expect(screen.getByText('Not exposed')).toBeTruthy()
  })

  it('saves changed export defaults through the config patch API', async () => {
    renderExportTab()

    await waitFor(() => {
      expect(screen.getByLabelText('Default Export Format')).toHaveValue('srt')
    })

    fireEvent.change(screen.getByLabelText('Default Export Format'), {
      target: { value: 'txt' },
    })
    fireEvent.click(screen.getByRole('switch', { name: 'Include Timestamps for TXT' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(exportTabMocks.patchExportDefaultsMock).toHaveBeenCalledWith({
        format: 'txt',
        include_timestamps: false,
      })
    })

    expect(exportTabMocks.toastSuccessMock).toHaveBeenCalledWith('Export defaults updated')
  })

  it('resets export defaults and reloads the effective values', async () => {
    exportTabMocks.fetchExportConfigMock
      .mockResolvedValueOnce({
        defaults: {
          format: 'txt',
          include_timestamps: false,
        },
      })
      .mockResolvedValueOnce({
        defaults: {
          format: 'srt',
          include_timestamps: true,
        },
      })

    renderExportTab()

    await waitFor(() => {
      expect(screen.getByLabelText('Default Export Format')).toHaveValue('txt')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }))

    await waitFor(() => {
      expect(exportTabMocks.deleteExportDefaultsMock).toHaveBeenCalledTimes(1)
    })

    expect(exportTabMocks.fetchExportConfigMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(exportTabMocks.toastSuccessMock).toHaveBeenCalledWith('Export defaults reset')

    await waitFor(() => {
      expect(screen.getByLabelText('Default Export Format')).toHaveValue('srt')
      expect(screen.getByRole('switch', { name: 'Include Timestamps for TXT' })).toHaveAttribute(
        'aria-checked',
        'true',
      )
    })
  })
})
