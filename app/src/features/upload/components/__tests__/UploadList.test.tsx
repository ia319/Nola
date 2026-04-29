// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/features/upload/types'
import { UploadList } from '../UploadList'

const uploadListMocks = vi.hoisted(() => ({
  logger: {
    warn: vi.fn(),
  },
}))

vi.mock('@/config/logger', () => ({
  default: uploadListMocks.logger,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const messages: Record<string, string> = {
        'tasks.uploadQueue.table.fileName': 'File Name',
        'tasks.uploadQueue.table.status': 'Status',
        'tasks.uploadQueue.table.size': 'Size',
        'tasks.uploadQueue.table.action': 'Action',
        'tasks.uploadQueue.status.pending': 'Pending',
        'tasks.uploadQueue.status.uploading': 'Uploading',
        'tasks.uploadQueue.status.ready': 'Ready',
        'tasks.uploadQueue.status.failed': 'Failed',
        'tasks.uploadQueue.status.cancelled': 'Cancelled',
        'upload.progress.cancel': 'Cancel',
        'upload.progress.retry': 'Retry',
        'upload.progress.remove': 'Remove',
        'upload.progress.cancelled': 'Cancelled',
        'upload.progress.error': 'Upload failed',
        'upload.error.fileTooLarge': 'File too large',
      }

      return messages[key] ?? key
    },
  }),
}))

function createFile(name: string, size: number): File {
  const file = new File(['audio'], name, { type: 'audio/mpeg' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function createUpload(overrides: Partial<UploadItem>): UploadItem {
  return {
    id: 'upload-id',
    file: createFile('sample.mp3', 1024),
    status: 'pending',
    progress: 0,
    error: null,
    fileId: null,
    taskCreated: false,
    ...overrides,
  }
}

function renderUploadList(overrides: Partial<Parameters<typeof UploadList>[0]> = {}) {
  const props = {
    uploads: [
      createUpload({
        id: 'upload-large',
        file: createFile('large.mp3', 4096),
        status: 'success',
        progress: 100,
        fileId: 'file-large',
      }),
      createUpload({
        id: 'upload-small',
        file: createFile('small.mp3', 1024),
        status: 'pending',
        progress: 0,
      }),
    ],
    onCancel: vi.fn(),
    onRetry: vi.fn(async () => {}),
    onRemove: vi.fn(async () => {}),
    ...overrides,
  }

  render(<UploadList {...props} />)
  return props
}

describe('UploadList', () => {
  beforeEach(() => {
    uploadListMocks.logger.warn.mockClear()
  })

  it('renders the existing upload queue grid headers and rows', () => {
    renderUploadList()

    expect(screen.getByText('File Name')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.getByText('Action')).toBeTruthy()
    expect(screen.getByText('large.mp3')).toBeTruthy()
    expect(screen.getByText('small.mp3')).toBeTruthy()
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('runs the cancel action for uploading rows', () => {
    const onCancel = vi.fn()
    renderUploadList({
      uploads: [
        createUpload({
          id: 'uploading',
          file: createFile('uploading.mp3', 1024),
          status: 'uploading',
          progress: 30,
        }),
      ],
      onCancel,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledWith('uploading')
  })

  it('runs retry and remove actions for failed rows', () => {
    const onRetry = vi.fn(async () => {})
    const onRemove = vi.fn(async () => {})

    renderUploadList({
      uploads: [
        createUpload({
          id: 'failed',
          file: createFile('failed.mp3', 300),
          status: 'error',
          error: {
            code: 'VALIDATION_EXTENSION',
            i18nKey: 'upload.error.fileTooLarge',
            retriable: false,
          },
        }),
      ],
      onRetry,
      onRemove,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onRetry).toHaveBeenCalledWith('failed')
    expect(onRemove).toHaveBeenCalledWith('failed')
  })
})
