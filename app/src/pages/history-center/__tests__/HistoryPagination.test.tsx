// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HistoryPagination } from '../HistoryPagination'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'history.pagination.summary') {
        return `${String(params?.start)}-${String(params?.end)} of ${String(params?.total)}`
      }

      if (key === 'history.pagination.page') {
        return `Page ${String(params?.page)}`
      }

      const messages: Record<string, string> = {
        'history.pagination.previous': 'Previous',
        'history.pagination.next': 'Next',
        'history.pagination.pageSize': 'Page size',
      }

      return messages[key] ?? key
    },
  }),
}))

describe('HistoryPagination', () => {
  it('keeps the next page visible when the current page is 3', () => {
    const onPageChange = vi.fn()

    render(
      <HistoryPagination
        page={3}
        pageSize={20}
        total={200}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Page 4' })).toBeTruthy()
  })

  it('keeps the previous page visible near the end of the range', () => {
    const onPageChange = vi.fn()

    render(
      <HistoryPagination
        page={8}
        pageSize={20}
        total={200}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Page 7' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Page 7' }))
    expect(onPageChange).toHaveBeenCalledWith(7)
  })

  it('labels the page-size control for assistive technologies', () => {
    render(
      <HistoryPagination
        page={1}
        pageSize={20}
        total={20}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Page size')).toBeTruthy()
  })
})
