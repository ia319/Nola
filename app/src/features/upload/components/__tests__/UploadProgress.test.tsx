import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UploadProgress } from '../UploadProgress'

const { tMock } = vi.hoisted(() => ({
  tMock: vi.fn((key: string) => key),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}))

describe('UploadProgress', () => {
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
        defaultValue: 'upload.progress.error',
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

    expect(screen.getByText('42%')).toBeTruthy()
    expect(screen.getByLabelText('upload.progress.cancel')).toBeTruthy()
    expect(screen.queryByText('upload.progress.retry')).toBeNull()
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

    expect(screen.getByText('upload.error.fileTooLarge')).toBeTruthy()
    expect(screen.getByText('upload.progress.retry')).toBeTruthy()
    expect(screen.getByLabelText('upload.progress.remove')).toBeTruthy()
  })

  it('renders success and cancelled terminal messages', () => {
    const { rerender } = render(
      <UploadProgress fileName="done.mp3" fileSize={1024} progress={100} status="success" />,
    )

    expect(screen.getByText('upload.progress.success')).toBeTruthy()

    rerender(<UploadProgress fileName="done.mp3" fileSize={1024} progress={0} status="cancelled" />)

    expect(screen.getByText('upload.progress.cancelled')).toBeTruthy()
  })
})
