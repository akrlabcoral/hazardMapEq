from __future__ import annotations

import asyncio
import logging

from app.models.repository import cleanup_old_data
from app.services.redis_client import redis_manager

logger = logging.getLogger("hazardmap.cleanup")


async def run_daily_cleanup() -> None:
    while True:
        await asyncio.sleep(24 * 60 * 60)
        lock_name = "lock:cron:cleanup"
        lock_token = await redis_manager.acquire_lock_token(lock_name, expire_seconds=3600)
        if not lock_token:
            logger.debug("[Cleanup] Skipped daily cleanup: lock held by another worker.")
            continue
            
        try:
            await asyncio.to_thread(cleanup_old_data)
            logger.info("[Cleanup] Daily DB cleanup complete.")
        except Exception as exc:
            logger.warning("[Cleanup] DB cleanup failed: %s", exc)
        finally:
            await redis_manager.release_lock(lock_name, lock_token)
