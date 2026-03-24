// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaskBatchActionBar } from '../TaskBatchActionBar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key
      return `${key}:${Object.entries(params)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(',')}`
    },
  }),
}))

describe('TaskBatchActionBar', () => {
  it('renders history actions and fires callbacks', () => {
    const onToggleCurrentPage = vi.fn()
    const onBatchCancel = vi.fn()
    const onBatchRetry = vi.fn()
    const onBatchExport = vi.fn()

    render(
      <TaskBatchActionBar
        scope="history"
        allCurrentPageSelected={false}
        selectedCount={2}
        hasCurrentPageTasks
        runningBatchAction={null}
        cancellableCount={1}
        retryableCount={1}
        exportableCount={1}
        onToggleCurrentPage={onToggleCurrentPage}
        onBatchCancel={onBatchCancel}
        onBatchRetry={onBatchRetry}
        onBatchExport={onBatchExport}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.selection.selectCurrentPage' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.batchActions.cancel:count=1' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.batchActions.retry:count=1' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'tasks.history.batchActions.export:count=1' }),
    )

    expect(onToggleCurrentPage).toHaveBeenCalledTimes(1)
    expect(onBatchCancel).toHaveBeenCalledTimes(1)
    expect(onBatchRetry).toHaveBeenCalledTimes(1)
    expect(onBatchExport).toHaveBeenCalledTimes(1)
    expect(screen.getByText('tasks.history.selection.selectedCount:count=2')).toBeTruthy()
  })

  it('disables actions by running state and eligibility', () => {
    render(
      <TaskBatchActionBar
        scope="currentBatch"
        allCurrentPageSelected
        selectedCount={0}
        hasCurrentPageTasks={false}
        runningBatchAction="cancel"
        cancellableCount={0}
        retryableCount={0}
        onToggleCurrentPage={() => {}}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'tasks.currentBatch.selection.clearCurrentPage' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'tasks.actions.cancelling' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'tasks.currentBatch.batchActions.retry:count=0' }),
    ).toBeDisabled()
  })
})
