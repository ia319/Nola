// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ActivityRouteTarget } from '@/features/activity'

import { AppShell } from '../AppShell'

const appShellMocks = vi.hoisted(() => ({
  activityCenterSheet: vi.fn(
    ({
      onNavigate,
      open,
    }: {
      onNavigate: (route: ActivityRouteTarget) => void
      open: boolean
      onOpenChange: (open: boolean) => void
    }) => (
      <div data-slot="mock-activity-center" data-open={String(open)}>
        activity center
        <button type="button" onClick={() => onNavigate('/models')}>
          go models
        </button>
      </div>
    ),
  ),
  appTopBar: vi.fn(
    ({
      onActivityClick,
      settingsTabs,
    }: {
      onActivityClick?: () => void
      settingsTabs?: ReactNode
    }) => (
      <div data-slot="mock-app-topbar">
        <button type="button" onClick={onActivityClick}>
          topbar
        </button>
        {settingsTabs}
      </div>
    ),
  ),
  appSidebar: vi.fn(() => <div data-slot="mock-app-sidebar">sidebar</div>),
  outlet: vi.fn(() => <div data-slot="mock-outlet">outlet</div>),
  activeLocale: 'zh' as 'zh' | 'en' | null,
  navigate: vi.fn(),
  requestCloseDetailOverlays: vi.fn(),
  taskPolling: vi.fn(),
  toaster: vi.fn(() => <div data-slot="mock-toaster">toaster</div>),
}))

vi.mock('../ActivityCenterSheet', () => ({
  ActivityCenterSheet: appShellMocks.activityCenterSheet,
}))

vi.mock('../AppSidebar', () => ({
  AppSidebar: appShellMocks.appSidebar,
}))

vi.mock('../AppTopBar', () => ({
  AppTopBar: appShellMocks.appTopBar,
}))

vi.mock('@/components/ui/sonner', () => ({
  Toaster: appShellMocks.toaster,
}))

vi.mock('@/app/locale/use-active-locale', () => ({
  useActiveLocale: () => appShellMocks.activeLocale,
}))

vi.mock('@/features/tasks', () => ({
  useTaskPolling: appShellMocks.taskPolling,
}))

vi.mock('@/shared/lib/overlay-events', () => ({
  requestCloseDetailOverlays: appShellMocks.requestCloseDetailOverlays,
}))

vi.mock('../AppLocaleController', () => ({
  AppLocaleController: () => null,
}))

vi.mock('@tanstack/react-router', () => ({
  Outlet: appShellMocks.outlet,
  useNavigate: () => appShellMocks.navigate,
}))

describe('AppShell', () => {
  beforeEach(() => {
    appShellMocks.activityCenterSheet.mockClear()
    appShellMocks.appTopBar.mockClear()
    appShellMocks.appSidebar.mockClear()
    appShellMocks.outlet.mockClear()
    appShellMocks.activeLocale = 'zh'
    appShellMocks.navigate.mockClear()
    appShellMocks.requestCloseDetailOverlays.mockClear()
    appShellMocks.taskPolling.mockClear()
    appShellMocks.toaster.mockClear()
  })

  it('composes the shell chrome, outlet area, polling, and toaster', () => {
    render(<AppShell />)

    expect(appShellMocks.taskPolling).toHaveBeenCalledTimes(1)
    expect(screen.getByText('sidebar')).toBeTruthy()
    expect(screen.getByText('topbar')).toBeTruthy()
    expect(screen.getByText('outlet').closest('[data-slot="app-shell-content"]')).toBeTruthy()
    expect(screen.getByText('activity center')).toHaveAttribute('data-open', 'false')
    expect(screen.getByText('toaster')).toBeTruthy()
    expect(screen.getByText('topbar').closest('[data-slot="app-shell-workspace"]')).toHaveClass(
      'lg:ml-[var(--sidebar-width)]',
    )
  })

  it('passes the optional settings tabs through to the top bar', () => {
    render(<AppShell settingsTabs={<div>settings tabs</div>} />)

    expect(appShellMocks.appTopBar).toHaveBeenCalledTimes(1)
    expect(appShellMocks.appTopBar.mock.calls[0]?.[0]).toMatchObject({
      settingsTabs: expect.any(Object),
    })
    expect(screen.getByText('settings tabs')).toBeTruthy()
  })

  it('opens the activity center from the top bar and closes detail overlays', () => {
    render(<AppShell />)

    fireEvent.click(screen.getByRole('button', { name: 'topbar' }))

    expect(appShellMocks.requestCloseDetailOverlays).toHaveBeenCalledTimes(1)
    expect(screen.getByText('activity center')).toHaveAttribute('data-open', 'true')
  })

  it('navigates activity routes with the active locale and closes the activity center', () => {
    render(<AppShell />)

    fireEvent.click(screen.getByRole('button', { name: 'topbar' }))
    fireEvent.click(screen.getByRole('button', { name: 'go models' }))

    expect(appShellMocks.navigate).toHaveBeenCalledWith({ to: '/zh/models' })
    expect(screen.getByText('activity center')).toHaveAttribute('data-open', 'false')
  })
})
