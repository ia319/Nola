import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '../ErrorBoundary'

vi.mock('@/config/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', async () => {
  const translate = (key: string) => key

  return {
    useTranslation: () => ({ t: translate }),
    withTranslation: () => (Component: ComponentType<Record<string, unknown>>) =>
      function Wrapped(props: Record<string, unknown>) {
        return <Component {...props} t={translate} />
      },
  }
})

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom')
  }
  return <div>safe child</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('error.boundary.title')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'error.boundary.retry' })).toBeTruthy()
  })

  it('retries rendering after the failure condition is cleared', () => {
    let shouldThrow = true

    const { rerender } = render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={shouldThrow} />
      </ErrorBoundary>,
    )

    shouldThrow = false
    rerender(
      <ErrorBoundary>
        <ProblemChild shouldThrow={shouldThrow} />
      </ErrorBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'error.boundary.retry' }))

    expect(screen.getByText('safe child')).toBeTruthy()
  })
})
