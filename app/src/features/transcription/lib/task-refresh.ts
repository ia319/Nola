import logger from '@/config/logger'

type TaskRefreshListener = () => void

// Keep task-action callers independent from React hooks by routing refresh
// requests through a lightweight in-memory notification mechanism.
const listeners = new Set<TaskRefreshListener>()

/** Allow any caller to register task-sync callbacks without hook coupling. */
export function subscribeTaskRefresh(listener: TaskRefreshListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Broadcast immediate sync requests after task mutations succeed. */
export function requestTaskRefresh(): void {
  // Iterate over a snapshot so subscription changes do not affect this emission cycle.
  for (const listener of Array.from(listeners)) {
    try {
      listener()
    } catch (error: unknown) {
      logger.error('task.refreshListenerFailed', { error })
    }
  }
}
