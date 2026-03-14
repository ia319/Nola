import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AdvancedOptions } from '../AdvancedOptions'
import type { TranscriptionOptionGroup } from '@/shared/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

function renderAdvancedOptions(
  schema: TranscriptionOptionGroup[],
  overrides?: Partial<Parameters<typeof AdvancedOptions>[0]>,
) {
  return render(
    <AdvancedOptions
      schema={schema}
      advancedOptions={{}}
      defaults={null}
      onOptionChange={vi.fn()}
      onReset={vi.fn()}
      {...overrides}
    />,
  )
}

describe('AdvancedOptions', () => {
  it('shows slider placeholders until backend defaults arrive', () => {
    const onOptionChange = vi.fn()
    const onReset = vi.fn()
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'decoding',
        group_label_key: 'options.group.decoding',
        fields: [
          {
            key: 'beam_size',
            label_key: 'options.field.beamSize',
            type: 'slider',
            min: 1,
            max: 10,
            step: 1,
          },
        ],
      },
    ]

    const { rerender } = render(
      <AdvancedOptions
        schema={schema}
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
        schema={schema}
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
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'decoding',
        group_label_key: 'options.group.decoding',
        fields: [
          {
            key: 'temperature',
            label_key: 'options.field.temperature',
            type: 'number_list',
            allow_negative: false,
            integer_only: false,
            collapse_single_value: true,
          },
        ],
      },
    ]

    renderAdvancedOptions(schema, { onOptionChange })
    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.toggle' }))

    const input = screen.getByLabelText('options.field.temperature') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.0,0.25' } })
    fireEvent.blur(input)

    expect(onOptionChange).toHaveBeenCalledWith('temperature', [0, 0.25])
    expect(input.value).toBe('0.0, 0.25')
  })

  it('collapses single temperature value to scalar on blur', () => {
    const onOptionChange = vi.fn()
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'decoding',
        group_label_key: 'options.group.decoding',
        fields: [
          {
            key: 'temperature',
            label_key: 'options.field.temperature',
            type: 'number_list',
            allow_negative: false,
            integer_only: false,
            collapse_single_value: true,
          },
        ],
      },
    ]

    renderAdvancedOptions(schema, { onOptionChange })
    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.toggle' }))

    const input = screen.getByLabelText('options.field.temperature') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.2' } })
    fireEvent.blur(input)

    expect(onOptionChange).toHaveBeenCalledWith('temperature', 0.2)
  })

  it('keeps suppress tokens as an array on blur', () => {
    const onOptionChange = vi.fn()
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'decoding',
        group_label_key: 'options.group.decoding',
        fields: [
          {
            key: 'suppress_tokens',
            label_key: 'options.field.suppressTokens',
            type: 'number_list',
            allow_negative: true,
            integer_only: true,
            collapse_single_value: false,
          },
        ],
      },
    ]

    renderAdvancedOptions(schema, { onOptionChange })
    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.toggle' }))

    const input = screen.getByLabelText('options.field.suppressTokens') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.blur(input)

    expect(onOptionChange).toHaveBeenCalledWith('suppress_tokens', [5])
  })

  it('keeps invalid temperature drafts visible until reset', () => {
    const onOptionChange = vi.fn()
    const onReset = vi.fn()
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'decoding',
        group_label_key: 'options.group.decoding',
        fields: [
          {
            key: 'temperature',
            label_key: 'options.field.temperature',
            type: 'number_list',
            allow_negative: false,
            integer_only: false,
            collapse_single_value: true,
          },
        ],
      },
    ]

    renderAdvancedOptions(schema, { onOptionChange, onReset })
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

  it('disables depends_on fields until the dependency becomes true', () => {
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'vad',
        group_label_key: 'options.group.vad',
        fields: [
          {
            key: 'vad_filter',
            label_key: 'options.field.vadFilter',
            type: 'switch',
          },
          {
            key: 'vad_parameters.min_speech_duration_ms',
            label_key: 'options.field.vadMinSpeechDurationMs',
            type: 'number',
            min: 0,
            max: 10000,
            step: 1,
            depends_on: 'vad_filter',
          },
        ],
      },
    ]

    const { rerender } = renderAdvancedOptions(schema, {
      defaults: {
        vad_filter: false,
        vad_parameters: { min_speech_duration_ms: 0 },
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.toggle' }))

    const input = screen.getByLabelText('options.field.vadMinSpeechDurationMs') as HTMLInputElement
    expect(input.disabled).toBe(true)

    rerender(
      <AdvancedOptions
        schema={schema}
        advancedOptions={{ vad_filter: true }}
        defaults={{
          vad_filter: false,
          vad_parameters: { min_speech_duration_ms: 0 },
        }}
        onOptionChange={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(
      screen.getByLabelText('options.field.vadMinSpeechDurationMs') as HTMLInputElement,
    ).toBeEnabled()
  })

  it('supports selecting special inf value for number fields', () => {
    const onOptionChange = vi.fn()
    const schema: TranscriptionOptionGroup[] = [
      {
        group: 'vad_advanced',
        group_label_key: 'options.group.vadAdvanced',
        fields: [
          {
            key: 'vad_parameters.max_speech_duration_s',
            label_key: 'options.field.vadMaxSpeechDurationS',
            type: 'number',
            min: 0,
            step: 1,
            special_values: ['inf'],
            depends_on: 'vad_filter',
          },
        ],
      },
    ]

    renderAdvancedOptions(schema, {
      defaults: { vad_filter: true },
      onOptionChange,
    })

    fireEvent.click(screen.getByRole('button', { name: 'options.advanced.toggle' }))
    fireEvent.click(screen.getByRole('button', { name: 'inf' }))

    expect(onOptionChange).toHaveBeenCalledWith('vad_parameters.max_speech_duration_s', 'inf')
  })
})
