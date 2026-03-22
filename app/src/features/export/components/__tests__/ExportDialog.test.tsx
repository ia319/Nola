// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ExportDialog, type ExportDialogValue } from '../ExportDialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key
      return `${key}:${Object.entries(params)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(',')}`
    },
  }),
}))

function buildValue(overrides: Partial<ExportDialogValue> = {}): ExportDialogValue {
  return {
    format: 'srt',
    includeTimestamps: true,
    target: 'download',
    filename: '',
    zipName: '',
    saveAsDefault: false,
    ...overrides,
  }
}

describe('ExportDialog', () => {
  it('renders single-export fields and forwards filename updates', () => {
    const onChange = vi.fn()

    render(
      <ExportDialog
        open
        mode="single"
        taskCount={1}
        defaultFilename="meeting.srt"
        value={buildValue()}
        onChange={onChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onResetDefaults={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('tasks.exportDialog.fields.target')).toBeInTheDocument()
    expect(screen.getByLabelText('tasks.exportDialog.fields.filename')).toBeInTheDocument()
    expect(
      screen.getByText('tasks.exportDialog.fields.defaultFilenameHint:filename=meeting.srt'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('tasks.exportDialog.fields.zipName')).not.toBeInTheDocument()

    const input = screen.getByLabelText('tasks.exportDialog.fields.filename')
    fireEvent.change(input, { target: { value: 'custom-name' } })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'custom-name',
      }),
    )
  })

  it('renders batch-export fields without single-export inputs', () => {
    render(
      <ExportDialog
        open
        mode="batch"
        taskCount={2}
        value={buildValue()}
        onChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onResetDefaults={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('tasks.exportDialog.fields.zipName')).toBeInTheDocument()
    expect(screen.getByText('tasks.exportDialog.fields.zipNameHint')).toBeInTheDocument()
    expect(screen.queryByLabelText('tasks.exportDialog.fields.target')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('tasks.exportDialog.fields.filename')).not.toBeInTheDocument()
  })
})
