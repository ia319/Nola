import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AdvancedOptions } from '../AdvancedOptions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('AdvancedOptions', () => {
  it('shows slider placeholders until backend defaults arrive', () => {
    const onOptionChange = vi.fn()
    const onReset = vi.fn()
    const { rerender } = render(
      <AdvancedOptions
        advancedOptions={{}}
        defaults={null}
        onOptionChange={onOptionChange}
        onReset={onReset}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.toggle' }))

    expect(screen.getAllByText('--').length).toBeGreaterThan(0)

    rerender(
      <AdvancedOptions
        advancedOptions={{}}
        defaults={{ beam_size: 5 }}
        onOptionChange={onOptionChange}
        onReset={onReset}
      />,
    )

    expect(screen.getByText('5')).toBeTruthy()
  })

  it('commits canonical temperature values on blur', () => {
    const onOptionChange = vi.fn()

    render(
      <AdvancedOptions
        advancedOptions={{}}
        defaults={null}
        onOptionChange={onOptionChange}
        onReset={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.toggle' }))

    const input = screen.getByLabelText('options.field.temperature') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.0,0.25' } })
    fireEvent.blur(input)

    expect(onOptionChange).toHaveBeenCalledWith('temperature', [0, 0.25])
    expect(input.value).toBe('0.0, 0.25')
  })

  it('keeps invalid temperature drafts visible until reset', () => {
    const onOptionChange = vi.fn()
    const onReset = vi.fn()

    render(
      <AdvancedOptions
        advancedOptions={{}}
        defaults={null}
        onOptionChange={onOptionChange}
        onReset={onReset}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.toggle' }))

    const input = screen.getByLabelText('options.field.temperature') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.2,,0.4' } })
    fireEvent.blur(input)

    expect(screen.getByText('options.advanced.numberListError.emptySegment')).toBeTruthy()
    expect(onOptionChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.reset' }))

    expect(onReset).toHaveBeenCalledTimes(1)
    expect((screen.getByLabelText('options.field.temperature') as HTMLInputElement).value).toBe('')
    expect(screen.queryByText('options.advanced.numberListError.emptySegment')).toBeNull()
  })
})
