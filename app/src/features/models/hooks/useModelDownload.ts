import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createSSEConnection } from '@/shared/lib/sse-client'

import { cancelDownload, startDownload } from '../api'
import type {
  DownloadProgressResponse,
  ModelDownloadSSEPayload,
  ModelDownloadStatus,
} from '../types'

export interface DownloadState {
  status: ModelDownloadStatus
  percent: number
  downloadedBytes: number
  totalBytes: number
  speedBps: number
  error?: string | null
}

export interface UseModelDownloadResult {
  downloads: Map<string, DownloadState>
  download: (modelId: string) => Promise<void>
  cancel: (modelId: string) => Promise<void>
}

export interface DownloadTerminalEvent {
  modelId: string
  status: Extract<ModelDownloadStatus, 'completed' | 'failed' | 'cancelled'>
  error?: string | null
}

/** Convert a REST snapshot into the hook-internal state shape. */
export function toDownloadState(progress: DownloadProgressResponse): DownloadState {
  return {
    status: 'downloading',
    percent: progress.percent,
    downloadedBytes: progress.downloaded_bytes,
    totalBytes: progress.total_bytes,
    speedBps: progress.speed_bps ?? 0,
    error: progress.error,
  }
}

/**
 * Manage model downloads with real-time SSE progress.
 *
 * Opens a persistent SSE connection on mount. Accepts `initialDownloads`
 * (built from GET /api/models `download_progress` fields) so in-flight
 * downloads survive page reloads. Terminal SSE events invoke `onTerminal`
 * so the consumer can refresh the model list.
 */
export function useModelDownload(
  initialDownloads: Map<string, DownloadState>,
  onTerminal?: (event: DownloadTerminalEvent) => void,
): UseModelDownloadResult {
  const [liveDownloads, setLiveDownloads] = useState<Map<string, DownloadState>>(new Map())
  const onTerminalRef = useRef(onTerminal)

  // Sync callback ref outside of the render phase to satisfy react-hooks/refs.
  useEffect(() => {
    onTerminalRef.current = onTerminal
  })

  const downloads = useMemo(() => {
    const merged = new Map(initialDownloads)
    for (const [modelId, state] of liveDownloads) {
      if (
        state.status === 'completed' ||
        state.status === 'failed' ||
        state.status === 'cancelled'
      ) {
        merged.delete(modelId)
      } else {
        merged.set(modelId, state)
      }
    }
    return merged
  }, [initialDownloads, liveDownloads])

  useEffect(() => {
    const cleanup = createSSEConnection<ModelDownloadSSEPayload>('/api/models/events', {
      eventNames: ['progress'],
      onMessage: ({ data }) => {
        const state: DownloadState = {
          status: data.status,
          percent: data.percent,
          downloadedBytes: data.downloaded_bytes,
          totalBytes: data.total_bytes,
          speedBps: data.speed_bps,
          error: data.error,
        }

        setLiveDownloads((prev) => {
          const next = new Map(prev)
          next.set(data.model_id, state)
          if (
            state.status === 'completed' ||
            state.status === 'failed' ||
            state.status === 'cancelled'
          ) {
            const terminalStatus: DownloadTerminalEvent['status'] = state.status
            queueMicrotask(() =>
              onTerminalRef.current?.({
                modelId: data.model_id,
                status: terminalStatus,
                error: state.error,
              }),
            )
          }
          return next
        })
      },
    })

    return cleanup
  }, [])

  const download = useCallback(async (modelId: string) => {
    await startDownload(modelId)
    setLiveDownloads((prev) => {
      const next = new Map(prev)
      // Clear any stale terminal tombstone from a previous download session.
      next.delete(modelId)
      return next
    })
    // Do not seed a zero-progress entry here; wait for the first SSE frame
    // to avoid overwriting real progress that may arrive before this callback.
  }, [])

  const cancel = useCallback(async (modelId: string) => {
    await cancelDownload(modelId)
  }, [])

  return { downloads, download, cancel }
}
