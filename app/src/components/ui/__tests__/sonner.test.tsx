// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Toaster } from '../sonner'

const toasterMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
  sonner: vi.fn((_: Record<string, unknown>) => <div data-slot="mock-sonner" />),
}))

vi.mock('@/components/use-theme', () => ({
  useTheme: toasterMocks.useTheme,
}))

vi.mock('sonner', () => ({
  Toaster: toasterMocks.sonner,
}))

describe('Toaster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('keeps the resolved app theme when a caller passes a theme prop', () => {
    toasterMocks.useTheme.mockReturnValue({
      theme: 'system',
      resolvedTheme: 'dark',
    })

    render(<Toaster theme="light" className="custom-toaster" />)

    expect(toasterMocks.sonner).toHaveBeenCalledTimes(1)
    const firstCall = toasterMocks.sonner.mock.calls.at(0)
    if (!firstCall) {
      throw new Error('sonner toaster was not called')
    }

    expect(firstCall[0]).toMatchObject({
      theme: 'dark',
      className: 'toaster group custom-toaster',
    })
  })
})
