// @vitest-environment jsdom

import { act, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelDownloadSSEPayload } from '@/features/models'
import { useTaskBoardStore } from '@/features/tasks/store/task-board-store'
import { queryKeys } from '@/shared/lib/query-keys'
import type { ActiveModelDownload, TaskSummary } from '@/shared/types'

import { useActivityStore } from '../store'
import { ActivityDataBridge } from '../ActivityDataBridge'

interface CapturedModelDownloadSseOptions {
  onMessage: (event: { data: ModelDownloadSSEPayload }) => void
  onError?: (error: Event) => void
}

const activityBridgeMocks = vi.hoisted(() => {
  return {
    listActiveModelDownloads: vi.fn(),
    requestModelRefresh: vi.fn(),
    refreshConfigCaches: vi.fn(),
    createSSEConnection: vi.fn(),
    sseOptions: null as CapturedModelDownloadSseOptions | null,
  }
})

vi.mock('@/features/models', () => ({
  listActiveModelDownloads: activityBridgeMocks.listActiveModelDownloads,
  requestModelRefresh: activityBridgeMocks.requestModelRefresh,
}))

vi.mock('@/config/cache-invalidation', () => ({
  refreshConfigCaches: activityBridgeMocks.refreshConfigCaches,
}))

vi.mock('@/shared/lib/sse-client', () => ({
  createSSEConnection: activityBridgeMocks.createSSEConnection,
}))

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderBridge(queryClient = createQueryClient()) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ActivityDataBridge />
      </QueryClientProvider>,
    ),
  }
}

function getCapturedSseOptions(): CapturedModelDownloadSseOptions {
  if (!activityBridgeMocks.sseOptions) {
    throw new Error('Expected activity SSE connection options')
  }

  return activityBridgeMocks.sseOptions
}

function buildTask(
  taskId: string,
  status: TaskSummary['status'],
  overrides: Partial<TaskSummary> = {},
): TaskSummary {
  return {
    task_id: taskId,
    file_id: `file-${taskId}`,
    filename: `${taskId}.wav`,
    model_id: 'small',
    status,
    progress: status === 'completed' ? 100 : 0,
    created_at: '2026-04-20T10:00:00.000Z',
    completed_at: status === 'completed' ? '2026-04-20T10:10:00.000Z' : null,
    ...overrides,
  }
}

function buildDownload(overrides: Partial<ActiveModelDownload> = {}): ActiveModelDownload {
  return {
    model_id: 'small',
    name: 'Small',
    status: 'downloading',
    percent: 20,
    downloaded_bytes: 20,
    total_bytes: 100,
    speed_bps: 5,
    error: null,
    ...overrides,
  }
}

beforeEach(() => {
  activityBridgeMocks.listActiveModelDownloads.mockResolvedValue({
    downloads: [],
    active_count: 0,
    total_speed_bps: 0,
  })
  activityBridgeMocks.requestModelRefresh.mockReset()
  activityBridgeMocks.refreshConfigCaches.mockResolvedValue({})
  activityBridgeMocks.createSSEConnection.mockImplementation((_path, options) => {
    activityBridgeMocks.sseOptions = options
    return vi.fn()
  })
})

afterEach(() => {
  useActivityStore.getState().clearActivity()
  useTaskBoardStore.getState().clearTaskBoard()
  activityBridgeMocks.listActiveModelDownloads.mockReset()
  activityBridgeMocks.refreshConfigCaches.mockReset()
  activityBridgeMocks.createSSEConnection.mockReset()
  activityBridgeMocks.sseOptions = null
})

describe('ActivityDataBridge', () => {
  it('adds completed task activity after an active task reaches a terminal state', async () => {
    const { queryClient } = renderBridge()
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      useTaskBoardStore.getState().setTasks([buildTask('task-1', 'processing')])
    })
    act(() => {
      useTaskBoardStore.getState().setTasks([
        buildTask('task-1', 'completed', {
          completed_at: '2026-04-20T10:12:00.000Z',
        }),
      ])
    })

    await waitFor(() => {
      expect(useActivityStore.getState().recent[0]).toHaveProperty('kind', 'task_completed')
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.lists() })
  })

  it('syncs active downloads and terminal SSE events into activity', async () => {
    activityBridgeMocks.listActiveModelDownloads.mockResolvedValue({
      downloads: [buildDownload()],
      active_count: 1,
      total_speed_bps: 5,
    })

    const { queryClient } = renderBridge()
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await waitFor(() => {
      expect(useActivityStore.getState().needsAttention).toEqual([])
      expect(useActivityStore.getState().inProgress[0]).toHaveProperty(
        'kind',
        'model_download_in_progress',
      )
    })

    const sseOptions = getCapturedSseOptions()

    act(() => {
      sseOptions.onMessage({
        data: {
          model_id: 'small',
          status: 'completed',
          percent: 100,
          downloaded_bytes: 100,
          total_bytes: 100,
          speed_bps: 0,
          error: null,
        },
      })
    })

    await waitFor(() => {
      expect(useActivityStore.getState().recent[0]).toHaveProperty(
        'kind',
        'model_download_completed',
      )
    })

    expect(activityBridgeMocks.requestModelRefresh).toHaveBeenCalledTimes(1)
    expect(activityBridgeMocks.refreshConfigCaches).toHaveBeenCalledTimes(1)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.models.downloads() })
  })

  it('records failed terminal model download events as recent activity', async () => {
    renderBridge()

    await waitFor(() => {
      expect(activityBridgeMocks.sseOptions).not.toBeNull()
    })

    const sseOptions = getCapturedSseOptions()

    act(() => {
      sseOptions.onMessage({
        data: {
          model_id: 'small',
          status: 'failed',
          percent: 40,
          downloaded_bytes: 40,
          total_bytes: 100,
          speed_bps: 0,
          error: 'Network failed',
        },
      })
    })

    await waitFor(() => {
      expect(useActivityStore.getState().recent[0]).toHaveProperty('kind', 'model_download_failed')
    })
    expect(useActivityStore.getState().recent[0]).toHaveProperty('model.error', 'Network failed')
  })
})
