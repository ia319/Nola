import type { Meta, StoryObj } from '@storybook/react-vite'
import { Download, Eye, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  InteractiveTable,
  InteractiveTableFilterBar,
  InteractiveTablePagination,
  InteractiveTableRowActionsMenu,
  type InteractiveBatchAction,
  type InteractiveTableRowAction,
  type LocalInteractiveTableSortComparator,
  type InteractiveSortState,
  type InteractiveTableColumn,
  useInteractiveTableSelection,
  useLocalInteractiveTableQuery,
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
    cell: (row) => <StatusBadge status={row.status} />,
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
    className: 'text-right',
    headerClassName: 'text-right',
    cell: (row) => (
      <InteractiveTableRowActionsMenu
        actions={getPreviewRowActions(row)}
        triggerLabel={`Actions for ${row.filename}`}
      />
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

const sortComparators = {
  filename: (left, right) => compareValues(left.filename, right.filename),
  status: (left, right) => compareValues(left.status, right.status),
  size: (left, right) => compareValues(left.size, right.size),
  progress: (left, right) => compareValues(left.progress, right.progress),
  createdAt: (left, right) => compareValues(left.createdAt, right.createdAt),
} satisfies Partial<Record<PreviewSortKey, LocalInteractiveTableSortComparator<PreviewRow>>>

function getPreviewRowActions(row: PreviewRow): readonly InteractiveTableRowAction[] {
  return [
    {
      id: 'details',
      label: 'Details',
      icon: <Eye />,
      run: () => undefined,
    },
    {
      id: 'retry',
      label: 'Retry',
      icon: <RotateCcw />,
      hidden: row.status !== 'failed',
      run: () => undefined,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 />,
      variant: 'destructive',
      hidden: row.status === 'pending',
      disabled: row.status === 'processing',
      run: () => undefined,
    },
  ]
}

function InteractiveTableHarness() {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(2)
  const [sort, setSort] = useState<InteractiveSortState<PreviewSortKey>>({
    key: 'createdAt',
    direction: 'desc',
  })
  const queryResult = useLocalInteractiveTableQuery({
    rows: previewRows,
    search: {
      query: searchQuery,
      getText: (row) => row.filename,
    },
    sort,
    sortComparators,
    pagination: {
      page,
      pageSize,
    },
  })
  const tableSelection = useInteractiveTableSelection({
    rows: queryResult.pageRows,
    getRowId: (row) => row.id,
    getRowSelectable: (row) => row.status !== 'processing',
    resetToken: `${searchQuery}|${sort.key}|${sort.direction}|${queryResult.page}|${queryResult.pageSize}`,
  })

  const batchActions = useMemo<readonly InteractiveBatchAction<PreviewRow>[]>(
    () => [
      {
        id: 'cancel',
        label: 'Cancel',
        icon: <X />,
        getEligibleRows: (rows) => rows.filter((row) => row.status === 'processing'),
        run: () => undefined,
      },
      {
        id: 'retry',
        label: 'Retry',
        icon: <RotateCcw />,
        getEligibleRows: (rows) => rows.filter((row) => row.status === 'failed'),
        run: () => undefined,
      },
      {
        id: 'export',
        label: 'Export',
        icon: <Download />,
        getEligibleRows: (rows) => rows.filter((row) => row.status === 'completed'),
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
        rows={queryResult.pageRows}
        getRowId={(row) => row.id}
        sort={sort}
        onSortChange={(nextSort) => {
          setSort(nextSort)
          setPage(1)
        }}
        filters={
          <InteractiveTableFilterBar
            leading={
              <label className="relative block w-full max-w-md">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  aria-label="Search files"
                  placeholder="Search filename"
                  className="bg-background pr-9 pl-9"
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setPage(1)
                  }}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => {
                      setSearchQuery('')
                      setPage(1)
                    }}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </label>
            }
          />
        }
        selection={{
          ...tableSelection.selection,
          getRowLabel: (row) => `Select ${row.filename}`,
          selectAllLabel: 'Select all visible selectable rows',
          selectedRowsLabel: (count) => `${count} selected`,
          clearSelectionLabel: 'Clear',
        }}
        batchActions={batchActions}
        pagination={
          <InteractiveTablePagination
            page={queryResult.page}
            pageSize={queryResult.pageSize}
            total={queryResult.filteredRowCount}
            pageSizeOptions={[2, 4]}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
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
