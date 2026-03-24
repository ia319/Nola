import { describe, expect, it } from 'vitest'

import {
  ACTIVE_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  isTerminalTaskStatus,
} from '../task-status-groups'

describe('task-status-groups', () => {
  it('tracks active and terminal status sets', () => {
    expect(ACTIVE_TASK_STATUSES.has('pending')).toBe(true)
    expect(ACTIVE_TASK_STATUSES.has('processing')).toBe(true)
    expect(ACTIVE_TASK_STATUSES.has('completed')).toBe(false)

    expect(TERMINAL_TASK_STATUSES.has('completed')).toBe(true)
    expect(TERMINAL_TASK_STATUSES.has('failed')).toBe(true)
    expect(TERMINAL_TASK_STATUSES.has('cancelled')).toBe(true)
    expect(TERMINAL_TASK_STATUSES.has('processing')).toBe(false)
  })

  it('checks terminal status through helper', () => {
    expect(isTerminalTaskStatus('completed')).toBe(true)
    expect(isTerminalTaskStatus('failed')).toBe(true)
    expect(isTerminalTaskStatus('cancelled')).toBe(true)
    expect(isTerminalTaskStatus('pending')).toBe(false)
    expect(isTerminalTaskStatus('processing')).toBe(false)
  })
})
