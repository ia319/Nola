// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { BellDot } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useUiPreferencesStore } from '@/app/locale/ui-preferences-store'
import { DEFAULT_UI_PREFERENCES } from '@/config/ui-preferences'

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
        'settings.tabs.liveRealtime': 'Live Realtime',
        'settings.tabs.export': 'Export',
        'settings.tabs.modelStorage': 'Model Storage',
        'settings.tabs.systemInfo': 'System Info',
        'components.workspaceSidePanel.close': 'Close panel',
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
import { WorkspaceSidePanel } from '../WorkspaceSidePanel'

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

describe('WorkspaceSidePanel', () => {
  function WorkspaceSidePanelHarness({ open = true }: { open?: boolean }) {
    const [isOpen, setIsOpen] = useState(open)

    return (
      <div className="flex min-h-0">
        <main>Main workspace</main>
        <WorkspaceSidePanel
          open={isOpen}
          onOpenChange={setIsOpen}
          title="Session settings"
          description="Tune runtime parameters."
          footer={<button type="button">Apply</button>}
          className="side-panel-shell"
          bodyClassName="side-panel-body"
        >
          <div>Runtime controls</div>
        </WorkspaceSidePanel>
      </div>
    )
  }

  function WorkspaceSidePanelFocusHarness() {
    const [isOpen, setIsOpen] = useState(false)

    return (
      <div className="flex min-h-0">
        <button type="button" onClick={() => setIsOpen(true)}>
          Open settings
        </button>
        <WorkspaceSidePanel
          open={isOpen}
          onOpenChange={setIsOpen}
          title="Session settings"
          description="Tune runtime parameters."
        >
          <button type="button">Runtime option</button>
        </WorkspaceSidePanel>
      </div>
    )
  }

  it('renders inline panel content and keeps slot class names separate', () => {
    render(<WorkspaceSidePanelHarness />)

    const panel = screen.getByText('Session settings').closest('[data-slot="workspace-side-panel"]')
    const body = screen
      .getByText('Runtime controls')
      .closest('[data-slot="workspace-side-panel-body"]')
    const footer = screen
      .getByRole('button', { name: 'Apply' })
      .closest('[data-slot="workspace-side-panel-footer"]')

    expect(panel).toHaveClass('side-panel-shell')
    expect(panel).toHaveClass('h-full')
    expect(body).toHaveClass('side-panel-body')
    expect(body).toHaveClass('overflow-y-auto')
    expect(footer).toHaveClass('shrink-0')
    expect(body).not.toHaveClass('side-panel-shell')
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy()
  })

  it('closes through the standard close button without unmounting siblings', () => {
    render(<WorkspaceSidePanelHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))

    expect(screen.queryByText('Runtime controls')).toBeNull()
    expect(screen.getByText('Main workspace')).toBeTruthy()
  })

  it('does not render when closed', () => {
    render(<WorkspaceSidePanelHarness open={false} />)

    expect(screen.queryByText('Runtime controls')).toBeNull()
    expect(screen.getByText('Main workspace')).toBeTruthy()
  })

  it('moves focus into the panel and restores focus after Escape closes it', () => {
    render(<WorkspaceSidePanelFocusHarness />)

    const trigger = screen.getByRole('button', { name: 'Open settings' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('button', { name: 'Close panel' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText('Runtime option')).toBeNull()
    expect(trigger).toHaveFocus()
  })
})

describe('SettingsLayout', () => {
  it('renders the settings page header copy and custom child content', () => {
    useUiPreferencesStore.setState({
      preferences: DEFAULT_UI_PREFERENCES,
      isHydrated: true,
    })
    layoutMocks.pathname = '/settings/export'

    render(
      <SettingsLayout>
        <div>Export body</div>
      </SettingsLayout>,
    )

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByText('Review and adjust product-level configuration.')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeTruthy()
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'General',
      'Transcription',
      'Live Realtime',
      'Export',
      'Model Storage',
      'System Info',
    ])
    expect(screen.getByRole('link', { name: 'Live Realtime' })).toHaveAttribute(
      'href',
      '/settings/live-realtime',
    )
    expect(screen.getByRole('link', { name: 'Export' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Export body')).toBeTruthy()
  })

  it('renders the nested settings outlet when no explicit children are provided', () => {
    useUiPreferencesStore.setState({
      preferences: DEFAULT_UI_PREFERENCES,
      isHydrated: true,
    })
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
