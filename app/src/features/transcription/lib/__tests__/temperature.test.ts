import { describe, expect, it } from 'vitest'

import {
  formatTemperatureValues,
  parseTemperatureDraft,
  serializeTemperatureValue,
} from '../temperature'

describe('formatTemperatureValues', () => {
  it('keeps integer temperatures aligned with backend decimal defaults', () => {
    expect(formatTemperatureValues([0, 0.25, 1])).toBe('0.0, 0.25, 1.0')
  })
})

describe('serializeTemperatureValue', () => {
  it('serializes scalar values', () => {
    expect(serializeTemperatureValue(0.2)).toBe('0.2')
  })

  it('serializes integer scalars with one decimal place', () => {
    expect(serializeTemperatureValue(0)).toBe('0.0')
  })

  it('serializes arrays via the shared formatter', () => {
    expect(serializeTemperatureValue([0, 0.2])).toBe('0.0, 0.2')
  })

  it('returns an empty draft for missing values', () => {
    expect(serializeTemperatureValue(undefined)).toBe('')
    expect(serializeTemperatureValue(null)).toBe('')
  })
})

describe('parseTemperatureDraft', () => {
  it('treats whitespace-only input as empty', () => {
    expect(parseTemperatureDraft('   ')).toEqual({ kind: 'empty' })
  })

  it('parses valid comma-separated decimals and normalizes spacing', () => {
    expect(parseTemperatureDraft('0.0,0.25, .4')).toEqual({
      kind: 'success',
      values: [0, 0.25, 0.4],
      canonical: '0.0, 0.25, 0.4',
    })
  })

  it('accepts a trailing separator as an incomplete final token', () => {
    expect(parseTemperatureDraft('0.2, 0.4,')).toEqual({
      kind: 'success',
      values: [0.2, 0.4],
      canonical: '0.2, 0.4',
    })
  })

  it('accepts decimal forms like 0. and normalizes them on commit', () => {
    expect(parseTemperatureDraft('0., .2')).toEqual({
      kind: 'success',
      values: [0, 0.2],
      canonical: '0.0, 0.2',
    })
  })

  it('rejects empty segments in the middle of the list', () => {
    expect(parseTemperatureDraft('0.2,,0.4')).toEqual({
      kind: 'error',
      code: 'emptySegment',
    })
  })

  it('rejects invalid characters instead of guessing intent', () => {
    expect(parseTemperatureDraft('0.2;0.4')).toEqual({
      kind: 'error',
      code: 'invalidCharacter',
    })
  })

  it('rejects malformed decimal tokens', () => {
    expect(parseTemperatureDraft('0.2, 0.2.')).toEqual({
      kind: 'error',
      code: 'invalidNumber',
    })
  })

  it('rejects negative values to match backend validation', () => {
    expect(parseTemperatureDraft('0, -0.2')).toEqual({
      kind: 'error',
      code: 'negativeNotAllowed',
    })
  })
})
