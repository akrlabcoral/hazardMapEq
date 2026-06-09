from __future__ import annotations

import asyncio
import logging

from app.models.repository import cleanup_old_data

logger = logging.getLogger("hazardmap.cleanup")


async def run_daily_cleanup() -> None:
    while True:
        await asyncio.sleep(24 * 60 * 60)
        try:
            await asyncio.to_thread(cleanup_old_data)
            logger.info("[Cleanup] Daily DB cleanup complete.")
        except Exception as exc:
            logger.warning("[Cleanup] DB cleanup failed: %s", exc)
