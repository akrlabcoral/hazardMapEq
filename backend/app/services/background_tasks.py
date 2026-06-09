from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

logger = logging.getLogger("hazardmap.background")


class BackgroundTaskManager:
    def __init__(self) -> None:
        self._tasks: list[asyncio.Task] = []

    def start(self, coro_factory: Callable[[], Awaitable[None]], name: str) -> asyncio.Task:
        task = asyncio.create_task(coro_factory(), name=name)
        self._tasks.append(task)
        return task

    async def stop_all(self) -> None:
        if not self._tasks:
            return
        logger.info("[Shutdown] Cancelling %d background task(s)...", len(self._tasks))
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
