// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FileUploaderProps, UploadItem } from '@/features/upload'
import type { UploadListProps } from '@/features/upload/components/UploadList'

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
        'upload.startUpload': 'Start Upload',
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
        hasPending={false}
        onFilesSelected={() => {}}
        onCancelUpload={() => {}}
        onRetryUpload={async () => {}}
        onRemoveUpload={async () => {}}
        onStartUpload={async () => {}}
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
    const onStartUpload = vi.fn(async () => {})
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
        hasPending
        onFilesSelected={() => {}}
        onCancelUpload={() => {}}
        onRetryUpload={async () => {}}
        onRemoveUpload={async () => {}}
        onStartUpload={onStartUpload}
        onReset={onReset}
      />,
    )

    expect(screen.getByText('upload list')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Upload' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reset All' })).toBeTruthy()
    expect(screen.getByText('Add More Files')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Start Upload' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset All' }))

    expect(onStartUpload).toHaveBeenCalledTimes(1)
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(uploadQueueMocks.uploadList.mock.calls[0]?.[0]).toMatchObject({
      uploads: expect.any(Array),
      onCancel: expect.any(Function),
      onRetry: expect.any(Function),
      onRemove: expect.any(Function),
    })
  })
})
