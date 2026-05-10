// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LiveWorkbenchCompactView } from '../LiveWorkbenchCompactView'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'live.workbench.compact.title': 'Compact live view',
          'live.workbench.compact.expand': 'Expand compact view',
          'live.workbench.compact.close': 'Close compact view',
          'live.workbench.compact.empty': 'No live transcript yet',
        }) as const
      )[key] ?? key,
  }),
}))

describe('LiveWorkbenchCompactView', () => {
  it('renders as a non-modal floating region when open', () => {
    render(<LiveWorkbenchCompactView open onOpenChange={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'Compact live view' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('No live transcript yet')).toBeTruthy()
  })

  it('closes from the close button and Escape key', () => {
    const onOpenChange = vi.fn()
    render(<LiveWorkbenchCompactView open onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close compact view' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onOpenChange).toHaveBeenCalledTimes(2)
    expect(onOpenChange).toHaveBeenNthCalledWith(1, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false)
  })

  it('expands through the callback and closes the compact view', () => {
    const onExpand = vi.fn()
    const onOpenChange = vi.fn()
    render(<LiveWorkbenchCompactView open onExpand={onExpand} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Expand compact view' }))

    expect(onExpand).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
