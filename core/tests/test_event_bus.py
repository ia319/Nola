"""Tests for the in-process event bus."""

from __future__ import annotations

import asyncio
from threading import Thread

from nola.common.event_bus import EventBus


def test_publish_delivers_payload_to_async_subscriber() -> None:
    """Publish one payload and deliver it to one async subscriber."""

    async def scenario() -> None:
        bus = EventBus()
        received: list[dict[str, object]] = []

        async def consume() -> None:
            async for payload in bus.subscribe("models"):
                received.append(payload)
                break

        task = asyncio.create_task(consume())
        await asyncio.sleep(0)

        bus.publish("models", {"status": "downloading", "percent": 42})
        await asyncio.wait_for(task, timeout=1)

        assert received == [{"status": "downloading", "percent": 42}]

    asyncio.run(scenario())


def test_publish_from_thread_reaches_async_subscriber() -> None:
    """Publish from a worker thread without touching the event loop directly."""

    async def scenario() -> None:
        bus = EventBus()
        received: list[dict[str, object]] = []

        async def consume() -> None:
            async for payload in bus.subscribe("models"):
                received.append(payload)
                break

        task = asyncio.create_task(consume())
        await asyncio.sleep(0)

        thread = Thread(
            target=bus.publish,
            args=("models", {"status": "completed", "model_id": "small"}),
        )
        thread.start()
        thread.join()

        await asyncio.wait_for(task, timeout=1)
        assert received == [{"status": "completed", "model_id": "small"}]

    asyncio.run(scenario())


def test_unsubscribe_stops_pending_subscriber() -> None:
    """Unsubscribe one subscriber and end the async generator cleanly."""

    async def scenario() -> None:
        bus = EventBus()
        completed = asyncio.Event()
        subscriber_id = "test-subscriber"

        async def consume() -> None:
            async for _payload in bus.subscribe("models", subscriber_id=subscriber_id):
                raise AssertionError(
                    "Subscriber should stop before receiving a payload"
                )
            completed.set()

        task = asyncio.create_task(consume())
        await asyncio.sleep(0)

        bus.unsubscribe("models", subscriber_id)

        await asyncio.wait_for(completed.wait(), timeout=1)
        await asyncio.wait_for(task, timeout=1)

    asyncio.run(scenario())
