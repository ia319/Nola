"""Thread-safe in-process event bus for async subscribers."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from copy import deepcopy
from dataclasses import dataclass
from threading import Lock
from uuid import uuid4

from nola.common.types import JsonDict


@dataclass(frozen=True, slots=True)
class _Subscriber:
    """Store one subscriber queue and the loop that owns it."""

    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[JsonDict | None]


class EventBus:
    """Publish payloads from any thread and stream them to async subscribers."""

    def __init__(self) -> None:
        """Initialize an empty event bus."""
        self._lock = Lock()
        self._subscribers: dict[str, dict[str, _Subscriber]] = {}

    def publish(self, channel: str, data: JsonDict) -> None:
        """Fan out one payload to every matching subscriber."""
        stale_subscribers: list[tuple[str, str]] = []
        subscribers = self._collect_subscribers(channel)

        for subscriber_channel, subscriber_id, subscriber in subscribers:
            try:
                subscriber.loop.call_soon_threadsafe(
                    subscriber.queue.put_nowait, deepcopy(data)
                )
            except RuntimeError:
                stale_subscribers.append((subscriber_channel, subscriber_id))

        for stale_channel, stale_subscriber_id in stale_subscribers:
            self._remove_subscriber(stale_channel, stale_subscriber_id)

    async def subscribe(
        self,
        channel: str,
        *,
        subscriber_id: str | None = None,
    ) -> AsyncGenerator[JsonDict, None]:
        """Yield payloads published to one channel until unsubscribed."""
        resolved_subscriber_id = subscriber_id or uuid4().hex
        queue: asyncio.Queue[JsonDict | None] = asyncio.Queue()
        subscriber = _Subscriber(loop=asyncio.get_running_loop(), queue=queue)
        self._add_subscriber(channel, resolved_subscriber_id, subscriber)

        try:
            while True:
                payload = await queue.get()
                if payload is None:
                    break
                yield payload
        finally:
            self._remove_subscriber(channel, resolved_subscriber_id)

    def unsubscribe(self, channel: str, subscriber_id: str) -> None:
        """Stop one subscriber and wake any pending consumer."""
        subscriber = self._remove_subscriber(channel, subscriber_id)
        if subscriber is None:
            return

        try:
            subscriber.loop.call_soon_threadsafe(subscriber.queue.put_nowait, None)
        except RuntimeError:
            pass

    def _collect_subscribers(self, channel: str) -> list[tuple[str, str, _Subscriber]]:
        """Return a stable snapshot of matching subscribers."""
        channels = [channel]
        if channel != "*":
            channels.append("*")

        with self._lock:
            return [
                (subscriber_channel, subscriber_id, subscriber)
                for subscriber_channel in channels
                for subscriber_id, subscriber in self._subscribers.get(
                    subscriber_channel, {}
                ).items()
            ]

    def _add_subscriber(
        self, channel: str, subscriber_id: str, subscriber: _Subscriber
    ) -> None:
        """Register one subscriber under one channel."""
        with self._lock:
            channel_subscribers = self._subscribers.setdefault(channel, {})
            channel_subscribers[subscriber_id] = subscriber

    def _remove_subscriber(
        self, channel: str, subscriber_id: str
    ) -> _Subscriber | None:
        """Remove one subscriber and clean up empty channel maps."""
        with self._lock:
            channel_subscribers = self._subscribers.get(channel)
            if channel_subscribers is None:
                return None

            subscriber = channel_subscribers.pop(subscriber_id, None)
            if not channel_subscribers:
                self._subscribers.pop(channel, None)
            return subscriber


event_bus = EventBus()

__all__ = ["EventBus", "event_bus"]
