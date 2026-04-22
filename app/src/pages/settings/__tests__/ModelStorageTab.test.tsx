// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const modelStorageMocks = vi.hoisted(() => ({
  getModelSettingsMock: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => {
      const messages: Record<string, string> = {
        'settings.modelStorage.loading': 'Loading model storage settings...',
        'settings.modelStorage.unavailable': 'Model storage settings are not available.',
        'settings.modelStorage.sections.current.label': 'Current State',
        'settings.modelStorage.sections.directory.label': 'Model Cache Directory',
        'settings.modelStorage.fields.configuredModel.label': 'Configured Model',
        'settings.modelStorage.fields.configuredModel.description': 'Review configured model.',
        'settings.modelStorage.fields.lastLoadedModel.label': 'Last Loaded Model',
        'settings.modelStorage.fields.lastLoadedModel.description': 'Review last loaded model.',
        'settings.modelStorage.fields.effectiveDirectory.label': 'Effective Model Directory',
        'settings.modelStorage.fields.effectiveDirectory.description': 'Reserve safe path display.',
        'settings.modelStorage.fields.overrideSource.label': 'Override Source',
        'settings.modelStorage.fields.overrideSource.description': 'Review override source.',
        'settings.modelStorage.fields.restartStatus.label': 'Restart Status',
        'settings.modelStorage.fields.restartStatus.description': 'Review restart state.',
        'settings.modelStorage.fields.configuredDirectory.label': 'Configured Cache Directory',
        'settings.modelStorage.fields.configuredDirectory.description': 'Reserve cache control.',
        'settings.modelStorage.fields.environmentOverride.label': 'Environment Override',
        'settings.modelStorage.fields.environmentOverride.description': 'Environment controls it.',
        'settings.modelStorage.fields.restartRequired.label': 'Restart Required',
        'settings.modelStorage.fields.restartRequired.description': 'Restart local service.',
        'settings.modelStorage.values.empty': 'Not set',
        'settings.modelStorage.values.directoryUnavailable': 'Safe path pending',
        'settings.modelStorage.values.environmentOverrideActive': 'Environment override active',
        'settings.modelStorage.values.restartRequired': 'Restart required',
        'settings.modelStorage.values.restartNotRequired': 'No restart required',
        'settings.modelStorage.values.overrideSource.environment': 'Environment',
        'settings.modelStorage.values.overrideSource.database': 'Stored setting',
        'settings.modelStorage.values.overrideSource.default': 'Default',
        'settings.modelStorage.actions.retry': 'Retry',
        'settings.modelStorage.actions.save': 'Save Changes',
      }

      if (key === 'settings.modelStorage.fields.configuredDirectory.current') {
        return `Current configured value: ${String(params?.path)}`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('@/features/models/api', () => ({
  getModelSettings: modelStorageMocks.getModelSettingsMock,
}))

import { ModelStorageTab } from '../ModelStorageTab'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderModelStorageTab(queryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ModelStorageTab />
    </QueryClientProvider>,
  )
}

describe('ModelStorageTab', () => {
  beforeEach(() => {
    modelStorageMocks.getModelSettingsMock.mockReset()
    modelStorageMocks.getModelSettingsMock.mockResolvedValue({
      configured_model_id: 'small',
      last_loaded_model_id: 'large-v3',
      configured_model_dir: 'D:/private/models',
      effective_model_dir: '/Users/private/models',
      override_source: 'database',
      restart_required: false,
    })
  })

  it('renders model storage state without exposing absolute backend paths', async () => {
    const { container } = renderModelStorageTab()

    await waitFor(() => {
      expect(screen.getByText('Current State')).toBeTruthy()
    })

    expect(screen.getByText('small')).toBeTruthy()
    expect(screen.getByText('large-v3')).toBeTruthy()
    expect(screen.getByText('Stored setting')).toBeTruthy()
    expect(screen.getByText('No restart required')).toBeTruthy()
    expect(screen.getAllByText('Safe path pending').length).toBeGreaterThan(0)
    expect(container.textContent).not.toContain('D:/private/models')
    expect(container.textContent).not.toContain('/Users/private/models')
    expect(screen.queryByDisplayValue('D:/private/models')).toBeNull()
    expect(screen.queryByDisplayValue('/Users/private/models')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  it('shows safe directory values in the reserved directory positions', async () => {
    modelStorageMocks.getModelSettingsMock.mockResolvedValueOnce({
      configured_model_id: null,
      last_loaded_model_id: null,
      configured_model_dir: 'Model cache',
      effective_model_dir: 'Model cache',
      override_source: 'environment',
      restart_required: true,
    })

    renderModelStorageTab()

    await waitFor(() => {
      expect(screen.getByText('Environment')).toBeTruthy()
    })

    expect(screen.getAllByText('Model cache').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Model cache')).toBeDisabled()
    expect(screen.getByText('Environment override active')).toBeTruthy()
    expect(screen.getAllByText('Restart required').length).toBeGreaterThan(0)
  })
})
