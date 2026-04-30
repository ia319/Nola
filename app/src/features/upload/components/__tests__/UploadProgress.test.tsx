// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UploadProgress } from '../UploadProgress'

const { tMock } = vi.hoisted(() => ({
  tMock: vi.fn((key: string, params?: Record<string, unknown>) => {
    const messages: Record<string, string> = {
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

    if (key === 'upload.error.fileTooLarge' && params?.defaultValue) {
      return messages[key]
    }

    return messages[key] ?? key
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}))

describe('UploadProgress', () => {
  beforeEach(() => {
    tMock.mockClear()
  })

  it('passes interpolation params to the translated error message', () => {
    render(
      <UploadProgress
        fileName="large.mp3"
        fileSize={1024}
        progress={0}
        status="error"
        errorKey="upload.error.fileTooLarge"
        errorParams={{ maxSize: '100 MB' }}
      />,
    )

    expect(tMock).toHaveBeenCalledWith(
      'upload.error.fileTooLarge',
      expect.objectContaining({
        maxSize: '100 MB',
        defaultValue: 'Upload failed',
      }),
    )
  })

  it('renders uploading state with progress and cancel action', () => {
    render(
      <UploadProgress
        fileName="audio.mp3"
        fileSize={1024}
        progress={42}
        status="uploading"
        onCancel={() => {}}
      />,
    )

    expect(screen.getByText('42% Uploading')).toBeTruthy()
    expect(screen.getByLabelText('Cancel')).toBeTruthy()
    expect(screen.queryByText('Retry')).toBeNull()
  })

  it('renders translated error text and recovery actions', () => {
    render(
      <UploadProgress
        fileName="bad.mp3"
        fileSize={1024}
        progress={0}
        status="error"
        errorKey="upload.error.fileTooLarge"
        onRetry={() => {}}
        onRemove={() => {}}
      />,
    )

    expect(screen.getByText('File too large')).toBeTruthy()
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
    expect(screen.getByLabelText('Remove')).toBeTruthy()
  })

  it('renders success and cancelled terminal messages', () => {
    const { rerender } = render(
      <UploadProgress fileName="done.mp3" fileSize={1024} progress={100} status="success" />,
    )

    expect(screen.getByText('Ready')).toBeTruthy()

    rerender(<UploadProgress fileName="done.mp3" fileSize={1024} progress={0} status="cancelled" />)

    expect(screen.getAllByText('Cancelled')).toHaveLength(2)
  })

  it('leaves keyboard selection to the row checkbox instead of the row container', () => {
    const onRowClick = vi.fn()

    const { container } = render(
      <UploadProgress
        fileName="selectable.mp3"
        fileSize={1024}
        progress={0}
        status="pending"
        onRowClick={onRowClick}
      />,
    )

    const row = container.querySelector('[data-slot="upload-progress-row"]')
    if (!(row instanceof HTMLElement)) {
      throw new Error('Expected upload row to exist')
    }
    fireEvent.click(row)
    expect(onRowClick).toHaveBeenCalledTimes(1)

    expect(row).not.toHaveAttribute('tabIndex')
    expect(row).not.toHaveAttribute('aria-selected')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })
})
