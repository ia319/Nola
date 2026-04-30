// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InteractiveTableBatchActionBar } from '../InteractiveTableBatchActionBar'

type Row = {
  id: string
  status: 'ready' | 'locked'
}

const rows: Row[] = [
  { id: 'row-1', status: 'ready' },
  { id: 'row-2', status: 'locked' },
]

describe('InteractiveTableBatchActionBar', () => {
  it('runs actions with eligible selected rows and shows the eligible count', () => {
    const run = vi.fn()

    render(
      <InteractiveTableBatchActionBar
        selectedRows={rows}
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            run,
            getEligibleRows: (selectedRows) => selectedRows.filter((row) => row.status === 'ready'),
          },
        ]}
        onClearSelection={vi.fn()}
      />,
    )

    const deleteButton = screen.getByRole('button', { name: /Delete/ })
    expect(deleteButton).toHaveTextContent('(1)')

    fireEvent.click(deleteButton)
    expect(run).toHaveBeenCalledWith([rows[0]])
  })

  it('disables actions when no selected rows are eligible', () => {
    const run = vi.fn()

    render(
      <InteractiveTableBatchActionBar
        selectedRows={rows}
        actions={[
          {
            id: 'archive',
            label: 'Archive',
            run,
            getEligibleRows: () => [],
          },
        ]}
        onClearSelection={vi.fn()}
      />,
    )

    const archiveButton = screen.getByRole('button', { name: /Archive/ })
    expect(archiveButton).toBeDisabled()
    expect(archiveButton).toHaveTextContent('(0)')

    fireEvent.click(archiveButton)
    expect(run).not.toHaveBeenCalled()
  })

  it('keeps the clear selection button available without actions', () => {
    const onClearSelection = vi.fn()

    render(
      <InteractiveTableBatchActionBar
        selectedRows={rows}
        actions={[]}
        onClearSelection={onClearSelection}
      />,
    )

    expect(screen.getByText('2 selected')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })
})
