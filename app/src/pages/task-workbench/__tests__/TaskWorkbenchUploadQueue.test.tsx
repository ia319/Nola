// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FileUploaderProps, UploadItem, UploadListProps } from '@/features/upload'

const uploadQueueMocks = vi.hoisted(() => ({
  fileUploader: vi.fn(
    ({ children, ariaLabel }: Pick<FileUploaderProps, 'children' | 'ariaLabel'>) => (
      <div data-slot="mock-file-uploader" aria-label={ariaLabel}>
        {children}
      </div>
    ),
  ),
  uploadList: vi.fn((_props: UploadListProps) => (
    <div data-slot="mock-upload-list">upload list</div>
  )),
  selectCancellableUploads: (uploads: UploadItem[]) =>
    uploads.filter((upload) => upload.status === 'uploading'),
  selectRemovableUploads: (uploads: UploadItem[]) =>
    uploads.filter((upload) => upload.status !== 'uploading'),
  selectRetryableUploads: (uploads: UploadItem[]) =>
    uploads.filter((upload) => upload.status === 'error' || upload.status === 'cancelled'),
  selectStartableUploads: (uploads: UploadItem[]) =>
    uploads.filter((upload) => upload.status === 'pending'),
  uploadStatusSortOrder: {
    pending: 0,
    uploading: 1,
    error: 2,
    cancelled: 3,
    success: 4,
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'tasks.workbench.sections.uploadQueue.title': 'Upload Queue',
        'tasks.uploadQueue.empty.title': 'No files uploaded yet',
        'tasks.uploadQueue.empty.description':
          'Drag and drop audio or video files here, or click the button below to browse.',
        'tasks.uploadQueue.empty.action': 'Select Files',
        'tasks.uploadQueue.actions.addMoreFiles': 'Add More Files',
        'tasks.uploadQueue.table.fileName': 'File Name',
        'tasks.uploadQueue.table.status': 'Status',
        'tasks.uploadQueue.table.size': 'Size',
        'tasks.uploadQueue.table.progress': 'Progress',
        'tasks.uploadQueue.table.action': 'Action',
        'tasks.uploadQueue.selection.selectAll': 'Select all uploads',
        'tasks.uploadQueue.batchActions.uploadSelected': `Upload selected (${String(params?.count)})`,
        'tasks.uploadQueue.batchActions.cancel': `Cancel (${String(params?.count)})`,
        'tasks.uploadQueue.batchActions.retry': `Retry (${String(params?.count)})`,
        'tasks.uploadQueue.batchActions.remove': `Remove (${String(params?.count)})`,
        'upload.progress.uploading': 'Uploading...',
        'upload.reset': 'Reset All',
      }

      if (key === 'tasks.workbench.sections.uploadQueue.maxFileSize') {
        return `Max file size: ${String(params?.maxSize)} per file`
      }

      return messages[key] ?? key
    },
  }),
}))

vi.mock('@/features/upload', () => ({
  FileUploader: uploadQueueMocks.fileUploader,
  UploadList: uploadQueueMocks.uploadList,
  selectCancellableUploads: uploadQueueMocks.selectCancellableUploads,
  selectRemovableUploads: uploadQueueMocks.selectRemovableUploads,
  selectRetryableUploads: uploadQueueMocks.selectRetryableUploads,
  selectStartableUploads: uploadQueueMocks.selectStartableUploads,
  UPLOAD_STATUS_SORT_ORDER: uploadQueueMocks.uploadStatusSortOrder,
}))

import { TaskWorkbenchUploadQueue } from '../TaskWorkbenchUploadQueue'

function createUpload(overrides: Partial<UploadItem>): UploadItem {
  return {
    id: 'upload-id',
    file: new File(['audio'], 'sample.wav', { type: 'audio/wav' }),
    status: 'pending',
    progress: 0,
    error: null,
    fileId: null,
    taskCreated: false,
    ...overrides,
  }
}

describe('TaskWorkbenchUploadQueue', () => {
  beforeEach(() => {
    uploadQueueMocks.fileUploader.mockClear()
    uploadQueueMocks.uploadList.mockClear()
  })

  it('renders the empty-state uploader with design-aligned copy', () => {
    render(
      <TaskWorkbenchUploadQueue
        uploads={[]}
        maxFileSize={500 * 1024 * 1024}
        isUploading={false}
        disabled={false}
        hasPending={false}
        onFilesSelected={() => {}}
        onCancelUpload={() => {}}
        onCancelUploads={() => {}}
        onRetryUpload={async () => {}}
        onRetryUploads={async () => {}}
        onRemoveUpload={async () => {}}
        onRemoveUploads={async () => {}}
        onStartUploads={async () => {}}
        onReset={async () => {}}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Upload Queue', level: 2 })).toBeTruthy()
    expect(screen.getByText('Max file size: 500.0 MB per file')).toBeTruthy()
    expect(screen.getByText('No files uploaded yet')).toBeTruthy()
    expect(
      screen.getByText(
        'Drag and drop audio or video files here, or click the button below to browse.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Select Files' })).toBeTruthy()
    expect(uploadQueueMocks.uploadList).not.toHaveBeenCalled()
  })

  it('renders the upload list and footer actions when files exist', () => {
    const onStartUploads = vi.fn(async () => {})
    const onReset = vi.fn(async () => {})

    render(
      <TaskWorkbenchUploadQueue
        uploads={[
          createUpload({
            id: 'upload-ready',
            status: 'success',
            progress: 100,
            fileId: 'file-ready',
          }),
          createUpload({
            id: 'upload-pending',
            status: 'pending',
          }),
        ]}
        maxFileSize={500 * 1024 * 1024}
        isUploading={false}
        disabled={false}
        hasPending
        onFilesSelected={() => {}}
        onCancelUpload={() => {}}
        onCancelUploads={() => {}}
        onRetryUpload={async () => {}}
        onRetryUploads={async () => {}}
        onRemoveUpload={async () => {}}
        onRemoveUploads={async () => {}}
        onStartUploads={onStartUploads}
        onReset={onReset}
      />,
    )

    expect(screen.getByText('upload list')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Upload selected (0)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel (0)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Retry (0)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove (0)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset All' })).toBeTruthy()
    expect(screen.getByText('Add More Files')).toBeTruthy()
    const footerActionLabels = screen.getAllByRole('button').map((button) => button.textContent)
    expect(footerActionLabels.slice(-2)).toEqual(['Upload selected (0)', 'Reset All'])

    fireEvent.click(screen.getByRole('button', { name: 'Reset All' }))

    expect(onStartUploads).not.toHaveBeenCalled()
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(uploadQueueMocks.uploadList.mock.calls[0]?.[0]).toMatchObject({
      uploads: expect.any(Array),
      onCancel: expect.any(Function),
      onRetry: expect.any(Function),
      onRemove: expect.any(Function),
      onSortChange: expect.any(Function),
      selection: expect.any(Object),
    })
  })

  it('keeps footer actions mounted and runs only eligible selected rows', async () => {
    const onStartUploads = vi.fn(async () => {})
    const onCancelUploads = vi.fn()
    const onRetryUploads = vi.fn(async () => {})
    const onRemoveUploads = vi.fn(async () => {})

    render(
      <TaskWorkbenchUploadQueue
        uploads={[
          createUpload({
            id: 'upload-pending',
            status: 'pending',
          }),
          createUpload({
            id: 'uploading',
            status: 'uploading',
            progress: 33,
          }),
          createUpload({
            id: 'failed',
            status: 'error',
          }),
          createUpload({
            id: 'ready',
            status: 'success',
            progress: 100,
            fileId: 'file-ready',
          }),
        ]}
        maxFileSize={500 * 1024 * 1024}
        isUploading={false}
        disabled={false}
        hasPending
        onFilesSelected={() => {}}
        onCancelUpload={() => {}}
        onCancelUploads={onCancelUploads}
        onRetryUpload={async () => {}}
        onRetryUploads={onRetryUploads}
        onRemoveUpload={async () => {}}
        onRemoveUploads={onRemoveUploads}
        onStartUploads={onStartUploads}
        onReset={async () => {}}
      />,
    )

    const uploadListProps = uploadQueueMocks.uploadList.mock.calls[0]?.[0]
    if (!uploadListProps?.selection) {
      throw new Error('Expected upload list selection props to be captured')
    }

    const { selection } = uploadListProps

    act(() => {
      selection.onToggleCurrentPage(true, uploadListProps.uploads)
    })

    expect(screen.getByRole('button', { name: 'Upload selected (1)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel (1)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Retry (1)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remove (3)' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Upload selected (1)' }))
    await waitFor(() => {
      expect(onStartUploads).toHaveBeenCalledWith(['upload-pending'])
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel (1)' }))
    await waitFor(() => {
      expect(onCancelUploads).toHaveBeenCalledWith(['uploading'])
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry (1)' }))
    await waitFor(() => {
      expect(onRetryUploads).toHaveBeenCalledWith(['failed'])
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove (3)' }))
    await waitFor(() => {
      expect(onRemoveUploads).toHaveBeenCalledWith(['upload-pending', 'failed', 'ready'])
    })
  })

  it('keeps queue actions disabled while upstream config is still loading', () => {
    render(
      <TaskWorkbenchUploadQueue
        uploads={[
          createUpload({
            id: 'upload-pending',
            status: 'pending',
          }),
        ]}
        maxFileSize={500 * 1024 * 1024}
        isUploading={false}
        disabled
        hasPending
        onFilesSelected={() => {}}
        onCancelUpload={() => {}}
        onCancelUploads={() => {}}
        onRetryUpload={async () => {}}
        onRetryUploads={async () => {}}
        onRemoveUpload={async () => {}}
        onRemoveUploads={async () => {}}
        onStartUploads={async () => {}}
        onReset={async () => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Upload selected (0)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset All' })).toBeDisabled()
  })
})
