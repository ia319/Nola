// @vitest-environment jsdom

import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '../AppShell'

const appShellMocks = vi.hoisted(() => ({
  appTopBar: vi.fn(({ settingsTabs }: { settingsTabs?: ReactNode }) => (
    <div data-slot="mock-app-topbar">{settingsTabs ?? 'topbar'}</div>
  )),
  appSidebar: vi.fn(() => <div data-slot="mock-app-sidebar">sidebar</div>),
  outlet: vi.fn(() => <div data-slot="mock-outlet">outlet</div>),
  taskPolling: vi.fn(),
  toaster: vi.fn(() => <div data-slot="mock-toaster">toaster</div>),
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

vi.mock('@/features/tasks', () => ({
  useTaskPolling: appShellMocks.taskPolling,
}))

vi.mock('@tanstack/react-router', () => ({
  Outlet: appShellMocks.outlet,
}))

describe('AppShell', () => {
  beforeEach(() => {
    appShellMocks.appTopBar.mockClear()
    appShellMocks.appSidebar.mockClear()
    appShellMocks.outlet.mockClear()
    appShellMocks.taskPolling.mockClear()
    appShellMocks.toaster.mockClear()
  })

  it('composes the shell chrome, outlet area, polling, and toaster', () => {
    render(<AppShell />)

    expect(appShellMocks.taskPolling).toHaveBeenCalledTimes(1)
    expect(screen.getByText('sidebar')).toBeTruthy()
    expect(screen.getByText('topbar')).toBeTruthy()
    expect(screen.getByText('outlet').closest('[data-slot="app-shell-content"]')).toBeTruthy()
    expect(screen.getByText('toaster')).toBeTruthy()
    expect(screen.getByText('outlet').closest('[data-slot="app-shell-main"]')).toHaveClass(
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
})
