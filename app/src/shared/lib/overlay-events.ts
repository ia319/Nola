import { useEffect } from 'react'

export const CLOSE_DETAIL_OVERLAYS_EVENT = 'nola:close-detail-overlays'

export function requestCloseDetailOverlays(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CLOSE_DETAIL_OVERLAYS_EVENT))
}

export function useDetailOverlayCloseRequest(onClose: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    window.addEventListener(CLOSE_DETAIL_OVERLAYS_EVENT, onClose)
    return () => {
      window.removeEventListener(CLOSE_DETAIL_OVERLAYS_EVENT, onClose)
    }
  }, [onClose])
}
