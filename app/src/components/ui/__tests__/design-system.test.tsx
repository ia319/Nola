// @vitest-environment jsdom

import { Button } from '@/components/ui/button'
import { render, screen, within } from '@testing-library/react'
import { BellDot } from 'lucide-react'
import { useState } from 'react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataTable } from '../DataTable'
import { DetailSheet } from '../DetailSheet'
import { EmptyState } from '../EmptyState'
import { MetricCard } from '../MetricCard'
import { ProgressBar } from '../ProgressBar'
import { StatusBadge } from '../StatusBadge'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const dictionary: Record<string, string> = {
        'tasks.status.processing': 'Processing',
        'tasks.status.completed': 'Completed',
        'models.status.downloading': 'Downloading',
        'models.status.downloaded': 'Downloaded',
      }
      return dictionary[key] ?? options?.defaultValue ?? key
    },
  }),
}))

describe('StatusBadge', () => {
  it('renders localized task and model states with semantic data attributes', () => {
    render(
      <>
        <StatusBadge status="processing" />
        <StatusBadge status="downloaded" />
      </>,
    )

    expect(screen.getByText('Processing').closest('[data-slot="status-badge"]')).toHaveAttribute(
      'data-kind',
      'task',
    )
    expect(screen.getByText('Downloaded').closest('[data-slot="status-badge"]')).toHaveAttribute(
      'data-kind',
      'model',
    )
  })

  it('falls back to a humanized label when a translation is missing', () => {
    render(<StatusBadge status="pending" />)

    expect(screen.getByText('Pending')).toBeTruthy()
  })
})

describe('MetricCard', () => {
  it('renders the metric label, value, and supporting content', () => {
    render(
      <MetricCard title="Files Uploaded" value="12" description="Current session total">
        <span>3 pending</span>
      </MetricCard>,
    )

    expect(screen.getByText('Files Uploaded')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Current session total')).toBeTruthy()
    expect(screen.getByText('3 pending')).toBeTruthy()
  })
})

describe('EmptyState', () => {
  it('renders the icon, message, and action affordance', () => {
    render(
      <EmptyState
        icon={<BellDot className="size-5" />}
        title="No activity yet"
        description="Recent events will appear here."
        action={<Button type="button">Refresh</Button>}
      />,
    )

    expect(screen.getByText('No activity yet')).toBeTruthy()
    expect(screen.getByText('Recent events will appear here.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
  })
})

describe('ProgressBar', () => {
  it('clamps percent values and renders the resolved value label', () => {
    render(<ProgressBar percent={140} label="Download progress" meta="4.2 MB/s" />)

    expect(screen.getByText('Download progress')).toBeTruthy()
    expect(screen.getByText('4.2 MB/s')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
  })
})

describe('DataTable', () => {
  type Row = {
    id: string
    name: string
    status: string
  }

  const rows: Row[] = [
    { id: 'row-1', name: 'Interview', status: 'Completed' },
    { id: 'row-2', name: 'Meeting', status: 'Processing' },
  ]

  it('renders configured columns and row content', () => {
    render(
      <DataTable
        caption="Files"
        rows={rows}
        getRowId={(row) => row.id}
        columns={[
          { key: 'name', header: 'Name', cell: (row) => row.name },
          { key: 'status', header: 'Status', cell: (row) => row.status },
        ]}
      />,
    )

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('Interview')).toBeTruthy()
    expect(screen.getByText('Processing')).toBeTruthy()
  })

  it('integrates the shared empty state when no rows exist', () => {
    render(
      <DataTable
        rows={[]}
        getRowId={(row: Row) => row.id}
        columns={[{ key: 'name', header: 'Name', cell: (row) => row.name }]}
        emptyState={{
          title: 'No files found',
          description: 'Upload a file to populate this table.',
        }}
      />,
    )

    expect(screen.getByText('No files found')).toBeTruthy()
    expect(screen.getByText('Upload a file to populate this table.')).toBeTruthy()
  })

  it('renders loading skeleton rows without falling back to the empty state', () => {
    render(
      <DataTable
        rows={[]}
        getRowId={(row: Row) => row.id}
        isLoading
        loadingRowCount={2}
        columns={[
          { key: 'name', header: 'Name', cell: (row) => row.name },
          { key: 'status', header: 'Status', cell: (row) => row.status },
        ]}
        emptyState={{
          title: 'No files found',
          description: 'Upload a file to populate this table.',
        }}
      />,
    )

    expect(screen.queryByText('No files found')).toBeNull()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('renders an error state with the provided recovery action', () => {
    const onRetry = vi.fn()

    render(
      <DataTable
        rows={[]}
        getRowId={(row: Row) => row.id}
        columns={[{ key: 'name', header: 'Name', cell: (row) => row.name }]}
        errorState={{
          title: 'Could not load records',
          description: 'The API returned an error.',
          action: (
            <Button type="button" onClick={onRetry}>
              Retry
            </Button>
          ),
        }}
      />,
    )

    expect(screen.getByText('Could not load records')).toBeTruthy()
    expect(screen.getByText('The API returned an error.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('supports row selection and row-click handling together', () => {
    const onToggleRow = vi.fn()
    const onToggleAllRows = vi.fn()
    const onRowClick = vi.fn()

    render(
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        onRowClick={onRowClick}
        columns={[{ key: 'name', header: 'Name', cell: (row) => row.name }]}
        selection={{
          selectedRowIds: ['row-2'],
          onToggleRow,
          onToggleAllRows,
          getRowLabel: (row) => `Select ${row.name}`,
          selectAllLabel: 'Select all files',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all files' }))
    expect(onToggleAllRows).toHaveBeenCalledWith(true, rows)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Interview' }))
    expect(onToggleRow).toHaveBeenCalledWith('row-1', true, rows[0])

    const interviewCell = screen.getByText('Interview')
    fireEvent.click(interviewCell)
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('allows sticky headers and custom scroll containers for dense console tables', () => {
    render(
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        stickyHeader
        scrollAreaClassName="max-h-40"
        columns={[{ key: 'name', header: 'Name', cell: (row) => row.name }]}
      />,
    )

    const header = screen.getByText('Name').closest('thead')
    expect(header).toHaveClass('sticky')
    expect(screen.getByRole('table').parentElement).toHaveClass('max-h-40')
  })
})

describe('DetailSheet', () => {
  function DetailSheetHarness({ mode = 'sheet' }: { mode?: 'dialog' | 'sheet' }) {
    const [open, setOpen] = useState(true)

    return (
      <DetailSheet
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        title="Task Detail"
        description="Inspect the current task state."
        footer={<Button type="button">Export</Button>}
      >
        <div>Detail body</div>
      </DetailSheet>
    )
  }

  it('renders dialog mode and closes through the standard close button', () => {
    render(<DetailSheetHarness mode="dialog" />)

    const sheet = screen.getByText('Task Detail').closest('[data-slot="detail-sheet"]')
    expect(sheet).toHaveAttribute('data-mode', 'dialog')
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Detail body')).toBeNull()
  })

  it('renders sheet mode with the provided content', () => {
    render(<DetailSheetHarness mode="sheet" />)

    const sheet = screen.getByText('Task Detail').closest('[data-slot="detail-sheet"]')
    if (!(sheet instanceof HTMLElement)) {
      throw new Error('detail sheet not found')
    }

    expect(sheet).toHaveAttribute('data-mode', 'sheet')
    expect(within(sheet).getByText('Detail body')).toBeTruthy()
  })

  it('keeps shell and body class names on separate elements', () => {
    render(
      <DetailSheet
        open
        onOpenChange={() => {}}
        title="Task Detail"
        className="sheet-shell"
        bodyClassName="sheet-body"
      >
        <div>Detail body</div>
      </DetailSheet>,
    )

    const sheet = screen.getByText('Task Detail').closest('[data-slot="detail-sheet"]')
    const body = screen.getByText('Detail body').closest('[data-slot="detail-sheet-body"]')

    expect(sheet).toHaveClass('sheet-shell')
    expect(body).toHaveClass('sheet-body')
    expect(body).not.toHaveClass('sheet-shell')
  })
})
