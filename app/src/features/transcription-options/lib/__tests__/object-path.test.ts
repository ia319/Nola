import { describe, expect, it } from 'vitest'

import { getValueByPath, setValueByPath } from '../object-path'

describe('object-path', () => {
  it('reads nested values with dot path', () => {
    const source = {
      audio: {
        language: {
          code: 'en',
        },
      },
    }

    expect(getValueByPath(source, 'audio.language.code')).toBe('en')
    expect(getValueByPath(source, 'audio.language')).toEqual({ code: 'en' })
  })

  it('returns undefined when path is missing or invalid', () => {
    const source = { audio: { language: { code: 'en' } } }

    expect(getValueByPath(source, 'audio.language.name')).toBeUndefined()
    expect(getValueByPath(source, '')).toBeUndefined()
    expect(getValueByPath(source, 'audio..code')).toBeUndefined()
    expect(getValueByPath(null, 'audio.language.code')).toBeUndefined()
  })

  it('does not read prototype pollution path segments', () => {
    expect(getValueByPath({}, 'constructor.prototype.polluted')).toBeUndefined()
    expect(getValueByPath({}, '__proto__.polluted')).toBeUndefined()
  })

  it('sets nested values and creates missing objects', () => {
    const target: Record<string, unknown> = {}

    setValueByPath(target, 'decoding.temperature', 0.3)
    setValueByPath(target, 'decoding.beam_size', 5)

    expect(target).toEqual({
      decoding: {
        temperature: 0.3,
        beam_size: 5,
      },
    })
  })

  it('replaces non-object branch before writing deep path', () => {
    const target: Record<string, unknown> = {
      decoding: 'fast',
    }

    setValueByPath(target, 'decoding.temperature', 0.7)

    expect(target).toEqual({
      decoding: {
        temperature: 0.7,
      },
    })
  })

  it('does not write prototype pollution path segments', () => {
    const target: Record<string, unknown> = {}

    setValueByPath(target, '__proto__.polluted', true)
    setValueByPath(target, 'constructor.prototype.polluted', true)
    setValueByPath(target, 'safe.prototype.polluted', true)

    expect(target).toEqual({})
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined()
  })

  it('does not write partial branches for malformed paths', () => {
    const target: Record<string, unknown> = {}

    setValueByPath(target, 'decoding..temperature', 0.3)
    setValueByPath(target, 'audio.language.', 'en')

    expect(target).toEqual({})
  })
})
