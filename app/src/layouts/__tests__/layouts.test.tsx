// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import { BellDot } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    className,
    children,
    ...props
  }: {
    to: string
    className?: string
    children: ReactNode
  }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-slot="mock-outlet" />,
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
  it('renders the default settings tab navigation and highlights the active section', () => {
    render(
      <SettingsLayout activeTab="export">
        <div>Export body</div>
      </SettingsLayout>,
    )

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Export' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Export body')).toBeTruthy()
  })

  it('can resolve the active tab from the current path when no explicit key is provided', () => {
    render(
      <SettingsLayout currentPath="/settings/model-storage">
        <div>Storage body</div>
      </SettingsLayout>,
    )

    expect(screen.getByRole('link', { name: 'Model Storage' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('keeps a tab active for nested settings paths', () => {
    render(
      <SettingsLayout currentPath="/settings/model-storage/cache">
        <div>Storage body</div>
      </SettingsLayout>,
    )

    expect(screen.getByRole('link', { name: 'Model Storage' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders disabled settings destinations as disabled buttons', () => {
    render(
      <SettingsLayout
        tabs={[
          {
            key: 'system-info',
            label: 'System Info',
            href: '/settings/system-info',
            disabled: true,
          },
        ]}
      >
        <div>Disabled body</div>
      </SettingsLayout>,
    )

    expect(screen.queryByRole('link', { name: 'System Info' })).toBeNull()
    expect(screen.getByRole('button', { name: 'System Info' })).toBeDisabled()
  })
})

describe('SectionHeader', () => {
  it('renders the section eyebrow, description, icon, and action affordance', () => {
    render(
      <SectionHeader
        label="Interface"
        title="Workspace Configuration"
        description="Manage how the Nola interface appears."
        icon={<BellDot className="size-4" />}
        action={<button type="button">Edit</button>}
      />,
    )

    expect(screen.getByText('Interface')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Workspace Configuration' })).toBeTruthy()
    expect(screen.getByText('Manage how the Nola interface appears.')).toBeTruthy()
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
        <select id="language" aria-label="Language">
          <option>English</option>
        </select>
      </FormRow>,
    )

    expect(screen.getByText('Interface Language')).toBeTruthy()
    expect(
      screen.getByText('Select the default language for menus and notifications.'),
    ).toBeTruthy()
    expect(screen.getByText('Required')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeTruthy()
  })
})
