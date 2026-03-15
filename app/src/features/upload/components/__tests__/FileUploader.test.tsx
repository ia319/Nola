// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FileUploader } from '../FileUploader'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('FileUploader', () => {
  it('forwards dropped files when enabled', () => {
    const onFilesSelected = vi.fn()
    const file = new File(['a'], 'audio.mp3', { type: 'audio/mpeg' })

    render(<FileUploader onFilesSelected={onFilesSelected} />)

    fireEvent.drop(screen.getByRole('button', { name: 'upload.dropzone.title' }), {
      dataTransfer: { files: [file] },
    })

    expect(onFilesSelected).toHaveBeenCalledWith([file])
  })

  it('opens the hidden input from keyboard activation', () => {
    const onFilesSelected = vi.fn()
    const { container } = render(<FileUploader onFilesSelected={onFilesSelected} />)
    const dropzone = screen.getByRole('button', { name: 'upload.dropzone.title' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    fireEvent.keyDown(dropzone, { key: 'Enter' })

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('blocks drop and keyboard actions when disabled', () => {
    const onFilesSelected = vi.fn()
    const file = new File(['a'], 'audio.mp3', { type: 'audio/mpeg' })
    const { container } = render(<FileUploader onFilesSelected={onFilesSelected} disabled />)
    const dropzone = screen.getByRole('button', { name: 'upload.dropzone.title' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    fireEvent.keyDown(dropzone, { key: 'Enter' })

    expect(onFilesSelected).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
    expect(dropzone.getAttribute('aria-disabled')).toBe('true')
  })
})
