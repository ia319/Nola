"""Track active live WebSocket writers."""

import asyncio


class LiveStreamConnectionRegistry:
    """Use only when one API worker process serves Live WebSockets."""

    def __init__(self) -> None:
        self._active_session_ids: set[str] = set()
        self._lock = asyncio.Lock()

    async def acquire(self, session_id: str) -> bool:
        """Reserve one session stream if it is not already active."""
        async with self._lock:
            if session_id in self._active_session_ids:
                return False
            self._active_session_ids.add(session_id)
            return True

    async def release(self, session_id: str) -> None:
        """Release one active session stream reservation."""
        async with self._lock:
            self._active_session_ids.discard(session_id)
