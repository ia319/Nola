import logger from '@/config/logger'

type ModelRefreshListener = () => void

const listeners = new Set<ModelRefreshListener>()

export function subscribeModelRefresh(listener: ModelRefreshListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function requestModelRefresh(): void {
  // Notify through a snapshot so listener changes do not affect this emission.
  for (const listener of Array.from(listeners)) {
    try {
      listener()
    } catch (error: unknown) {
      logger.error('models.refreshListenerFailed', { error })
    }
  }
}
