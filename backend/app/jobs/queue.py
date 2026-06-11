"""
app/jobs/queue.py

Distributed job queue interface for simulation workers.
Wraps RQ (Redis Queue) to replace the legacy local asyncio.Queue.
"""
from __future__ import annotations

import asyncio
import logging
import redis
from rq import Retry
from rq import Queue

from app.ingest.normalizer import EarthquakeEvent, event_to_payload
from app.jobs.rq_worker import run_simulation_job
from app.services.redis_client import redis_manager

logger = logging.getLogger("hazardmap.queue")

class SimulationQueue:
    def __init__(self):
        self._rq_queue = None
        self._redis_conn = None

    def _get_rq_queue(self) -> Queue:
        if self._rq_queue is None:
            # RQ requires a synchronous redis connection
            # We derive the URL from our shared redis_manager
            url = redis_manager.url if hasattr(redis_manager, 'url') else "redis://localhost:6379"
            self._redis_conn = redis.Redis.from_url(url)
            self._rq_queue = Queue('hazard_simulations', connection=self._redis_conn)
        return self._rq_queue

    def put_nowait(self, event: EarthquakeEvent) -> None:
        """
        Maintains backwards compatibility with asyncio.Queue.put_nowait()
        Synchronous push to Redis. (Sub-millisecond, safe for event loop).
        """
        if not redis_manager._is_connected:
            raise asyncio.QueueFull("Redis is unavailable; simulation job was not queued.")

        try:
            q = self._get_rq_queue()
            
            # Serialize the event object to a raw dict for RQ Pickling compatibility
            event_dict = event_to_payload(event)
            event_dict["db_id"] = event.db_id
            
            job_identity = event.db_id if event.db_id is not None else event.source_id
            q.enqueue(
                run_simulation_job,
                event_dict,
                job_id=f"sim:{job_identity}",
                job_timeout=300,
                result_ttl=0,
                failure_ttl=86400,
                ttl=3600,
                retry=Retry(max=2, interval=[30, 120]),
            )
            logger.debug(f"[Queue] Enqueued to RQ: {event.source_id}")
        except Exception as exc:
            logger.error(f"[Queue] Failed to enqueue to RQ: {exc}")
            raise asyncio.QueueFull(f"Redis RQ unavailable: {exc}")

    def qsize(self) -> int:
        try:
            if not redis_manager._is_connected:
                return 0
            return self._get_rq_queue().count
        except Exception:
            return 0


# Shared singleton instance
_queue = SimulationQueue()

def get_queue() -> SimulationQueue:
    return _queue

async def enqueue(event: EarthquakeEvent) -> None:
    """Async wrapper for putting events onto the RQ."""
    await asyncio.to_thread(_queue.put_nowait, event)
