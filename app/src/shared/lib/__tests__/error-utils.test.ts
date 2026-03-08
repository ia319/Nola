import { describe, expect, it } from 'vitest'

import { formatApiError } from '../error-utils'

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
})
