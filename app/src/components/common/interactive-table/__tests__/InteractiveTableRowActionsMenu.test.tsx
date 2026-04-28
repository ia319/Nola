// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InteractiveTableRowActionsMenu } from '../InteractiveTableRowActionsMenu'

function openMenu(label = 'More actions'): void {
  fireEvent.pointerDown(screen.getByRole('button', { name: label }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
}

describe('InteractiveTableRowActionsMenu', () => {
  it('renders feature-provided row actions from the overflow trigger', async () => {
    const onDetails = vi.fn()
    const onRetry = vi.fn()
    const onDelete = vi.fn()

    render(
      <InteractiveTableRowActionsMenu
        triggerLabel="Actions for audio.wav"
        actions={[
          {
            id: 'details',
            label: 'Details',
            run: onDetails,
          },
          {
            id: 'retry',
            label: 'Retry',
            hidden: true,
            run: onRetry,
          },
          {
            id: 'delete',
            label: 'Delete',
            disabled: true,
            variant: 'destructive',
            run: onDelete,
          },
        ]}
      />,
    )

    openMenu('Actions for audio.wav')

    expect(await screen.findByRole('menuitem', { name: 'Details' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Retry' })).toBeNull()

    const deleteItem = screen.getByRole('menuitem', { name: 'Delete' })
    expect(deleteItem).toHaveAttribute('data-variant', 'destructive')
    expect(deleteItem).toHaveAttribute('data-disabled')
    expect(deleteItem).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(deleteItem)
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Details' }))
    expect(onDetails).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('keeps disabled actions visible but unavailable', async () => {
    const onDelete = vi.fn()

    render(
      <InteractiveTableRowActionsMenu
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            disabled: true,
            variant: 'destructive',
            run: onDelete,
          },
        ]}
      />,
    )

    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()

    const deleteButton = await screen.findByRole('button', { name: 'Delete' })
    expect(deleteButton).toBeDisabled()
    expect(deleteButton).toHaveAttribute('data-disabled')
    expect(deleteButton).toHaveAttribute('data-action-variant', 'destructive')
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(deleteButton)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('renders a single visible action as a direct row button', () => {
    const onRetry = vi.fn()

    render(
      <InteractiveTableRowActionsMenu
        actions={[
          {
            id: 'details',
            label: 'Details',
            hidden: true,
            run: vi.fn(),
          },
          {
            id: 'retry',
            label: 'Retry',
            run: onRetry,
          },
        ]}
      />,
    )

    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
