// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Toaster } from '../sonner'

const toasterMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
  sonner: vi.fn((_: Record<string, unknown>) => <div data-slot="mock-sonner" />),
}))

vi.mock('next-themes', () => ({
  useTheme: toasterMocks.useTheme,
}))

vi.mock('sonner', () => ({
  Toaster: toasterMocks.sonner,
}))

describe('Toaster', () => {
  it('passes the resolved theme to sonner when the app theme follows the system', () => {
    toasterMocks.useTheme.mockReturnValue({
      theme: 'system',
      resolvedTheme: 'dark',
    })

    render(<Toaster richColors />)

    expect(toasterMocks.sonner).toHaveBeenCalledTimes(1)
    const firstCall = toasterMocks.sonner.mock.calls.at(0)
    if (!firstCall) {
      throw new Error('sonner toaster was not called')
    }

    expect(firstCall[0]).toMatchObject({
      theme: 'dark',
      className: 'toaster group',
      richColors: true,
    })
  })
})
