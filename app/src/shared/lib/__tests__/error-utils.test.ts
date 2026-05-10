import { describe, expect, it } from 'vitest'

import { formatApiError, getApiErrorCode } from '../error-utils'

describe('formatApiError', () => {
  it('returns string detail unchanged', () => {
    expect(formatApiError({ detail: 'plain message' })).toBe('plain message')
  })

  it('joins validation messages with semicolons', () => {
    expect(
      formatApiError({
        detail: [
          { loc: ['body', 'file_id'], msg: 'field required', type: 'missing' },
          { loc: ['body', 'task'], msg: 'invalid task', type: 'value_error' },
        ],
      }),
    ).toBe('field required; invalid task')
  })

  it('reads structured backend error details', () => {
    const error = {
      detail: {
        code: 'runtime_config_invalid',
        message: 'Mock Live realtime does not support runtime option overrides',
      },
    }

    expect(formatApiError(error)).toBe(
      'Mock Live realtime does not support runtime option overrides',
    )
    expect(getApiErrorCode(error)).toBe('runtime_config_invalid')
  })

  it('falls back for malformed structured details', () => {
    const error = { detail: null } as unknown as Parameters<typeof formatApiError>[0]

    expect(formatApiError(error)).toBe('Unexpected API error')
    expect(getApiErrorCode(error)).toBeUndefined()
  })
})
