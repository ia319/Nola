// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { BellDot } from 'lucide-react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const layoutMocks = vi.hoisted(() => ({
  pathname: '/settings/export',
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    className,
    children,
    ...props
  }: {
    to: string
    params?: { tab?: string }
    className?: string
    children: ReactNode
  }) => (
    <a href={params?.tab ? to.replace('$tab', params.tab) : to} className={className} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="mock-outlet" data-slot="mock-outlet" />,
  useLocation: ({ select }: { select?: (location: { pathname: string }) => string } = {}) =>
    select ? select({ pathname: layoutMocks.pathname }) : { pathname: layoutMocks.pathname },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'settings.title': 'Settings',
        'settings.description': 'Review and adjust product-level configuration.',
        'settings.navigationLabel': 'Settings sections',
        'settings.tabs.general': 'General',
        'settings.tabs.transcription': 'Transcription',
        'settings.tabs.export': 'Export',
        'settings.tabs.modelStorage': 'Model Storage',
        'settings.tabs.systemInfo': 'System Info',
      }

      return messages[key] ?? key
    },
  }),
}))

import { ContentCanvas } from '../ContentCanvas'
import { FormRow } from '../FormRow'
import { PageHeader } from '../PageHeader'
import { SectionHeader } from '../SectionHeader'
import { SettingsLayout } from '../SettingsLayout'
import { TwoColumnLayout } from '../TwoColumnLayout'

describe('ContentCanvas', () => {
  it('renders the expected semantic wrapper and default canvas classes', () => {
    render(
      <ContentCanvas as="main" className="custom-canvas">
        <div>Canvas body</div>
      </ContentCanvas>,
    )

    const canvas = screen.getByRole('main')
    expect(canvas).toHaveClass('max-w-5xl')
    expect(canvas).toHaveClass('custom-canvas')
    expect(screen.getByText('Canvas body')).toBeTruthy()
  })

  it('supports explicit workspace width and height variants', () => {
    render(
      <ContentCanvas as="section" width="full" height="fill">
        <div>Wide canvas body</div>
      </ContentCanvas>,
    )

    const canvas = screen.getByText('Wide canvas body').parentElement

    expect(canvas).toHaveClass('max-w-none')
    expect(canvas).toHaveClass('flex-1')
    expect(canvas).toHaveClass('min-h-0')
  })
})

describe('PageHeader', () => {
  it('renders title, description, and action content together', () => {
    render(
      <PageHeader
        title="Models"
        description="Configure and monitor system-level neural models."
        actions={<button type="button">Refresh</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Models' })).toBeTruthy()
    expect(screen.getByText('Configure and monitor system-level neural models.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
  })
})

describe('TwoColumnLayout', () => {
  it('uses the planned content-heavy desktop split by default', () => {
    render(<TwoColumnLayout left={<div>Left column</div>} right={<div>Right column</div>} />)

    const left = screen.getByText('Left column').parentElement
    const right = screen.getByText('Right column').parentElement

    expect(left).toHaveClass('lg:col-span-7')
    expect(right).toHaveClass('lg:col-span-5')
  })

  it('supports alternate desktop ratios when requested', () => {
    render(
      <TwoColumnLayout
        left={<div>Left column</div>}
        right={<div>Right column</div>}
        ratio="balanced"
      />,
    )

    const left = screen.getByText('Left column').parentElement
    const right = screen.getByText('Right column').parentElement

    expect(left).toHaveClass('lg:col-span-6')
    expect(right).toHaveClass('lg:col-span-6')
  })

  it('supports the sidebar-heavy desktop split', () => {
    render(
      <TwoColumnLayout
        left={<div>Left column</div>}
        right={<div>Right column</div>}
        ratio="sidebar-heavy"
      />,
    )

    const left = screen.getByText('Left column').parentElement
    const right = screen.getByText('Right column').parentElement

    expect(left).toHaveClass('lg:col-span-5')
    expect(right).toHaveClass('lg:col-span-7')
  })
})

describe('SettingsLayout', () => {
  it('renders the settings page header copy and custom child content', () => {
    layoutMocks.pathname = '/settings/export'

    render(
      <SettingsLayout>
        <div>Export body</div>
      </SettingsLayout>,
    )

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByText('Review and adjust product-level configuration.')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Export' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Export body')).toBeTruthy()
  })

  it('renders the nested settings outlet when no explicit children are provided', () => {
    layoutMocks.pathname = '/settings/system-info'

    render(<SettingsLayout />)

    expect(screen.getByText('Settings')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'System Info' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByTestId('mock-outlet')).toBeTruthy()
  })
})

describe('SectionHeader', () => {
  it('renders the section eyebrow, description, icon, and action affordance', () => {
    render(
      <SectionHeader
        label="Interface"
        title="Workspace Configuration"
        description="Manage how the Nola interface appears."
        icon={<BellDot data-testid="section-header-icon" className="size-4" />}
        action={<button type="button">Edit</button>}
      />,
    )

    expect(screen.getByText('Interface')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Workspace Configuration' })).toBeTruthy()
    expect(screen.getByText('Manage how the Nola interface appears.')).toBeTruthy()
    expect(screen.getByTestId('section-header-icon')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })
})

describe('FormRow', () => {
  it('renders the setting label, helper text, and control slot', () => {
    render(
      <FormRow
        label="Interface Language"
        description="Select the default language for menus and notifications."
        htmlFor="language"
        action={<span>Required</span>}
      >
        <select id="language">
          <option>English</option>
        </select>
      </FormRow>,
    )

    expect(screen.getByText('Interface Language')).toBeTruthy()
    expect(
      screen.getByText('Select the default language for menus and notifications.'),
    ).toBeTruthy()
    expect(screen.getByText('Required')).toBeTruthy()
    expect(screen.getByLabelText('Interface Language')).toBeTruthy()
  })
})
