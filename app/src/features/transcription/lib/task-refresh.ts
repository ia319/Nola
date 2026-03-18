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
  for (const listener of listeners) {
    listener()
  }
}
