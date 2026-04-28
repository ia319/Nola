import type { Meta, StoryObj } from '@storybook/react-vite'
import { RefreshCcw, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  InteractiveTable,
  InteractiveTableFilterBar,
  type InteractiveBatchAction,
  type InteractiveSortState,
  type InteractiveTableColumn,
} from '.'

type PreviewStatus = 'pending' | 'processing' | 'completed' | 'failed'
type PreviewSortKey = 'filename' | 'status' | 'size' | 'progress' | 'createdAt'

type PreviewRow = {
  id: string
  filename: string
  status: PreviewStatus
  size: number
  progress: number
  createdAt: string
}

const previewRows: readonly PreviewRow[] = [
  {
    id: 'task-1024',
    filename: 'interview-notes.wav',
    status: 'completed',
    size: 48_300_000,
    progress: 100,
    createdAt: '2026-04-26 09:18',
  },
  {
    id: 'task-1025',
    filename: 'product-sync.mp4',
    status: 'processing',
    size: 214_800_000,
    progress: 62,
    createdAt: '2026-04-26 10:04',
  },
  {
    id: 'task-1026',
    filename: 'language-sample.flac',
    status: 'failed',
    size: 92_700_000,
    progress: 34,
    createdAt: '2026-04-26 10:42',
  },
  {
    id: 'task-1027',
    filename: 'meeting-room-a.m4a',
    status: 'pending',
    size: 31_200_000,
    progress: 0,
    createdAt: '2026-04-26 11:09',
  },
]

const statusStyles: Record<PreviewStatus, string> = {
  pending: 'border-border bg-surface-container text-muted-foreground',
  processing: 'border-primary/30 bg-primary/10 text-primary',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'border-destructive/30 bg-destructive/10 text-destructive',
}

const columns: readonly InteractiveTableColumn<PreviewRow, PreviewSortKey>[] = [
  {
    id: 'filename',
    header: 'Filename',
    sortKey: 'filename',
    cell: (row) => <span className="font-medium">{row.filename}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    sortKey: 'status',
    cell: (row) => (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[row.status]}`}
      >
        {row.status}
      </span>
    ),
  },
  {
    id: 'size',
    header: 'Size',
    sortKey: 'size',
    defaultSortDirection: 'desc',
    cell: (row) => formatFileSize(row.size),
  },
  {
    id: 'progress',
    header: 'Progress',
    sortKey: 'progress',
    defaultSortDirection: 'desc',
    cell: (row) => (
      <div className="min-w-36 space-y-1">
        <Progress value={row.progress} />
        <span className="text-muted-foreground text-xs">{row.progress}%</span>
      </div>
    ),
  },
  {
    id: 'createdAt',
    header: 'Created At',
    sortKey: 'createdAt',
    cell: (row) => <span className="text-muted-foreground">{row.createdAt}</span>,
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: (row) => (
      <Button type="button" size="sm" variant="outline" disabled={row.status === 'processing'}>
        Open
      </Button>
    ),
  },
]

const meta = {
  title: 'Components/Common/InteractiveTable',
  parameters: {
    layout: 'padded',
  },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function formatFileSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function compareValues(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left).localeCompare(String(right))
}

function getSortValue(row: PreviewRow, key: PreviewSortKey): string | number {
  switch (key) {
    case 'filename':
      return row.filename
    case 'status':
      return row.status
    case 'size':
      return row.size
    case 'progress':
      return row.progress
    case 'createdAt':
      return row.createdAt
  }
}

function sortRows(
  rows: readonly PreviewRow[],
  sort: InteractiveSortState<PreviewSortKey>,
): readonly PreviewRow[] {
  return [...rows].sort((left, right) => {
    const result =
      compareValues(getSortValue(left, sort.key), getSortValue(right, sort.key)) ||
      left.id.localeCompare(right.id)

    return sort.direction === 'asc' ? result : -result
  })
}

function InteractiveTableHarness() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<InteractiveSortState<PreviewSortKey>>({
    key: 'createdAt',
    direction: 'desc',
  })
  const [selectedRowIds, setSelectedRowIds] = useState<readonly string[]>([])

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filteredRows = normalizedQuery
      ? previewRows.filter((row) => row.filename.toLowerCase().includes(normalizedQuery))
      : previewRows

    return sortRows(filteredRows, sort)
  }, [query, sort])

  const batchActions = useMemo<readonly InteractiveBatchAction<PreviewRow>[]>(
    () => [
      {
        id: 'retry',
        label: 'Retry',
        icon: <RefreshCcw className="size-4" />,
        getEligibleRows: (rows) => rows.filter((row) => row.status === 'failed'),
        run: () => undefined,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="size-4" />,
        variant: 'destructive',
        getEligibleRows: (rows) => rows.filter((row) => row.status !== 'processing'),
        run: () => undefined,
      },
    ],
    [],
  )

  return (
    <div className="max-w-5xl space-y-4">
      <InteractiveTable
        caption="Interactive table preview"
        columns={columns}
        rows={visibleRows}
        getRowId={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
        filters={
          <InteractiveTableFilterBar
            leading={
              <div className="relative max-w-xs flex-1">
                <Input
                  value={query}
                  aria-label="Search files"
                  placeholder="Search filename"
                  className="pr-9"
                  onChange={(event) => {
                    setQuery(event.target.value)
                  }}
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => {
                      setQuery('')
                    }}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </div>
            }
          />
        }
        selection={{
          selectedRowIds,
          getRowSelectable: (row) => row.status !== 'processing',
          getRowLabel: (row) => `Select ${row.filename}`,
          selectAllLabel: 'Select all visible selectable rows',
          selectedRowsLabel: (count) => `${count} selected`,
          clearSelectionLabel: 'Clear',
          onToggleRow: (row, checked) => {
            setSelectedRowIds((current) =>
              checked ? [...current, row.id] : current.filter((rowId) => rowId !== row.id),
            )
          },
          onToggleCurrentPage: (checked, rows) => {
            const rowIds = rows.map((row) => row.id)
            setSelectedRowIds((current) =>
              checked
                ? Array.from(new Set([...current, ...rowIds]))
                : current.filter((rowId) => !rowIds.includes(rowId)),
            )
          },
          onClearSelection: () => {
            setSelectedRowIds([])
          },
        }}
        batchActions={batchActions}
        pagination={
          <p className="text-muted-foreground text-xs">
            Showing {visibleRows.length} of {previewRows.length} preview rows
          </p>
        }
        emptyState={{
          title: 'No files match the current filters',
          description: 'Adjust the filename search to restore rows.',
        }}
      />
    </div>
  )
}

export const Playground: Story = {
  render: () => <InteractiveTableHarness />,
}

export const Loading: Story = {
  render: () => (
    <div className="max-w-5xl">
      <InteractiveTable
        caption="Loading table preview"
        columns={columns}
        rows={previewRows}
        getRowId={(row) => row.id}
        isLoading
      />
    </div>
  ),
}

export const Empty: Story = {
  render: () => (
    <div className="max-w-5xl">
      <InteractiveTable
        caption="Empty table preview"
        columns={columns}
        rows={[]}
        getRowId={(row: PreviewRow) => row.id}
        emptyState={{
          title: 'No records yet',
          description: 'Rows will appear here after data is loaded.',
        }}
      />
    </div>
  ),
}

export const Error: Story = {
  render: () => (
    <div className="max-w-5xl">
      <InteractiveTable
        caption="Error table preview"
        columns={columns}
        rows={[]}
        getRowId={(row: PreviewRow) => row.id}
        errorState={{
          title: 'Could not load records',
          description: 'The table keeps the same error-state surface as DataTable.',
          action: (
            <Button type="button" variant="outline">
              Retry
            </Button>
          ),
        }}
      />
    </div>
  ),
}
