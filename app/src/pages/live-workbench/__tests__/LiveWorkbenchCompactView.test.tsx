// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LiveWorkbenchCompactView } from '../LiveWorkbenchCompactView'
import type { LiveWorkbenchCompactViewProps } from '../LiveWorkbenchCompactView'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'live.workbench.compact.title': 'Compact live view',
          'live.workbench.compact.expand': 'Expand compact view',
          'live.workbench.compact.close': 'Close compact view',
          'live.workbench.actions.stop': 'Stop session',
          'live.workbench.sources.microphone': 'Microphone',
          'live.workbench.sources.system': 'System audio',
          'live.workbench.compact.empty': 'No live transcript yet',
        }) as const
      )[key] ?? key,
  }),
}))

function renderCompactView(overrides: Partial<LiveWorkbenchCompactViewProps> = {}) {
  const props: LiveWorkbenchCompactViewProps = {
    open: true,
    status: 'Recording',
    duration: '0:03',
    items: [],
    microphoneEnabled: true,
    microphoneStatus: 'Ready',
    systemAudioEnabled: false,
    systemAudioStatus: 'Ready',
    onOpenChange: vi.fn(),
    ...overrides,
  }

  return {
    props,
    ...render(<LiveWorkbenchCompactView {...props} />),
  }
}

describe('LiveWorkbenchCompactView', () => {
  it('renders as browser compact window content when open', () => {
    renderCompactView()

    const compactView = screen.getByRole('region', { name: 'Compact live view' })
    expect(compactView).toBeTruthy()
    expect(compactView).toHaveClass('h-screen', 'w-screen')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Recording · 0:03')).toBeTruthy()
    expect(screen.getByText('Microphone')).toBeTruthy()
    expect(screen.getByText('System audio')).toBeTruthy()
    expect(screen.getByText('No live transcript yet')).toBeTruthy()
  })

  it('focuses the close button and scopes Escape to the compact view', () => {
    const onOpenChange = vi.fn()
    renderCompactView({ onOpenChange })

    const closeButton = screen.getByRole('button', { name: 'Close compact view' })
    expect(closeButton).toHaveFocus()

    fireEvent.click(closeButton)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenNthCalledWith(1, false)

    onOpenChange.mockClear()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()

    fireEvent.keyDown(closeButton, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('expands through the callback without owning the close behavior', () => {
    const onExpand = vi.fn()
    const onOpenChange = vi.fn()
    renderCompactView({ onExpand, onOpenChange })

    fireEvent.click(screen.getByRole('button', { name: 'Expand compact view' }))

    expect(onExpand).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('uses the shared stop action', () => {
    const onStop = vi.fn()
    renderCompactView({ onStop })

    fireEvent.click(screen.getByRole('button', { name: 'Stop session' }))

    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
