// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InteractiveTablePagination } from '../InteractiveTablePagination'

describe('InteractiveTablePagination', () => {
  it('renders the normalized range and page-size control', () => {
    render(
      <InteractiveTablePagination
        page={1}
        pageSize={20}
        total={55}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Showing 1-20 of 55')).toBeTruthy()
    expect(screen.getByLabelText('Page size')).toBeTruthy()
  })

  it('keeps neighboring pages visible and calls the page handler', () => {
    const onPageChange = vi.fn()

    render(
      <InteractiveTablePagination
        page={3}
        pageSize={20}
        total={200}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Page 4' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Page 4' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('supports localized labels from the feature layer', () => {
    render(
      <InteractiveTablePagination
        page={2}
        pageSize={10}
        total={21}
        labels={{
          summary: (model) => `${model.start}-${model.end}/${model.total}`,
          pageSize: 'Rows',
          previous: 'Back',
          next: 'Forward',
          page: (page) => `Go to ${page}`,
        }}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(screen.getByText('11-20/21')).toBeTruthy()
    expect(screen.getByLabelText('Rows')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Forward' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Go to 2' })).toHaveAttribute('aria-current', 'page')
  })

  it('hides the page-size control when no page-size handler is provided', () => {
    render(<InteractiveTablePagination page={1} pageSize={20} total={20} onPageChange={vi.fn()} />)

    expect(screen.queryByLabelText('Page size')).toBeNull()
  })
})
