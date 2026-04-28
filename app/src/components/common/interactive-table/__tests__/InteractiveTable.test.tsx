// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InteractiveTable } from '../InteractiveTable'
import { InteractiveTableRowActionsMenu } from '../InteractiveTableRowActionsMenu'
import type { InteractiveTableColumn } from '../types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { rowId?: string }) => {
      const dictionary: Record<string, string> = {
        'components.dataTable.empty.title': 'No items found',
        'components.dataTable.empty.description': 'Add records or adjust filters.',
        'components.dataTable.selectAll': 'Select all rows',
        'components.dataTable.selectRow': `Select row ${String(options?.rowId ?? '')}`,
      }
      return dictionary[key] ?? key
    },
  }),
}))

type Row = {
  id: string
  name: string
  status: 'ready' | 'locked'
}

type SortKey = 'name' | 'status'

const rows: Row[] = [
  { id: 'row-1', name: 'Alpha', status: 'ready' },
  { id: 'row-2', name: 'Beta', status: 'locked' },
  { id: 'row-3', name: 'Gamma', status: 'ready' },
]

function buildColumns(extra?: Partial<InteractiveTableColumn<Row, SortKey>>) {
  return [
    {
      id: 'name',
      header: 'Name',
      sortKey: 'name',
      cell: (row) => row.name,
      ...extra,
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: 'status',
      defaultSortDirection: 'desc',
      cell: (row) => row.status,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: () => <button type="button">Row action</button>,
    },
  ] satisfies InteractiveTableColumn<Row, SortKey>[]
}

describe('InteractiveTable', () => {
  it('uses column headers to request sort changes', () => {
    const onSortChange = vi.fn()
    const { rerender } = render(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={buildColumns()}
        sort={null}
        onSortChange={onSortChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sort Name ascending' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' })

    rerender(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={buildColumns()}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sort Name descending' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'desc' })

    fireEvent.click(screen.getByRole('button', { name: 'Sort Status descending' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'status', direction: 'desc' })
  })

  it('exposes neutral, ascending, and descending sort states', () => {
    const onSortChange = vi.fn()
    const { rerender } = render(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={buildColumns()}
        sort={null}
        onSortChange={onSortChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'Sort Name ascending' })).toHaveAttribute(
      'data-sort-state',
      'none',
    )

    rerender(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={buildColumns()}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    )

    const ascendingButton = screen.getByRole('button', { name: 'Sort Name descending' })
    const ascendingIcons = ascendingButton.querySelectorAll('svg')
    expect(ascendingButton).toHaveAttribute('data-sort-state', 'asc')
    expect(ascendingIcons).toHaveLength(2)
    expect(ascendingIcons[0]).toHaveClass('text-foreground')
    expect(ascendingIcons[1]).toHaveClass('text-muted-foreground/45')

    rerender(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={buildColumns()}
        sort={{ key: 'name', direction: 'desc' }}
        onSortChange={onSortChange}
      />,
    )

    const descendingButton = screen.getByRole('button', { name: 'Sort Name ascending' })
    const descendingIcons = descendingButton.querySelectorAll('svg')
    expect(descendingButton).toHaveAttribute('data-sort-state', 'desc')
    expect(descendingIcons).toHaveLength(2)
    expect(descendingIcons[0]).toHaveClass('text-muted-foreground/45')
    expect(descendingIcons[1]).toHaveClass('text-foreground')
  })

  it('keeps checkbox and nested actions from opening clickable rows', () => {
    const onRowClick = vi.fn()
    const onToggleRow = vi.fn()
    const onActionClick = vi.fn()

    render(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={[
          {
            id: 'name',
            header: 'Name',
            cell: (row) => row.name,
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: () => (
              <>
                <button type="button" onClick={onActionClick}>
                  Row action
                </button>
                <a href="#details">Details link</a>
              </>
            ),
          },
        ]}
        selection={{
          selectedRowIds: [],
          onToggleRow,
          onToggleCurrentPage: vi.fn(),
          onClearSelection: vi.fn(),
          getRowLabel: (row) => `Select ${row.name}`,
        }}
        onRowClick={onRowClick}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alpha' }))
    expect(onToggleRow).toHaveBeenCalledWith(rows[0], true)
    expect(onRowClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'Row action' })[0])
    expect(onActionClick).toHaveBeenCalledTimes(1)
    expect(onRowClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('link', { name: 'Details link' })[0])
    expect(onRowClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Alpha'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('keeps row action menus from opening clickable rows', () => {
    const onRowClick = vi.fn()
    const onDetails = vi.fn()

    render(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={[
          {
            id: 'name',
            header: 'Name',
            cell: (row) => row.name,
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: () => (
              <InteractiveTableRowActionsMenu
                actions={[
                  {
                    id: 'details',
                    label: 'Details',
                    run: onDetails,
                  },
                ]}
              />
            ),
          },
        ]}
        onRowClick={onRowClick}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0])
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('renders filters and selected-row actions in one toolbar', () => {
    render(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={buildColumns()}
        filters={<input aria-label="Search rows" />}
        selection={{
          selectedRowIds: ['row-1'],
          onToggleRow: vi.fn(),
          onToggleCurrentPage: vi.fn(),
          onClearSelection: vi.fn(),
        }}
        batchActions={[
          {
            id: 'delete',
            label: 'Delete',
            run: vi.fn(),
          },
        ]}
      />,
    )

    const toolbar = screen
      .getByLabelText('Search rows')
      .closest('[data-slot="interactive-table-toolbar"]')

    expect(toolbar).toContainElement(screen.getByLabelText('Search rows'))
    expect(toolbar).toContainElement(screen.getByRole('button', { name: /Delete/ }))
  })

  it('skips unselectable rows when selecting the current page', () => {
    const onToggleCurrentPage = vi.fn()

    render(
      <InteractiveTable
        rows={rows}
        getRowId={(row) => row.id}
        columns={buildColumns()}
        selection={{
          selectedRowIds: [],
          onToggleRow: vi.fn(),
          onToggleCurrentPage,
          onClearSelection: vi.fn(),
          getRowSelectable: (row) => row.status !== 'locked',
          selectAllLabel: 'Select current rows',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current rows' }))
    expect(onToggleCurrentPage).toHaveBeenCalledWith(true, [rows[0], rows[2]])
  })
})
