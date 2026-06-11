"""
app/jobs/queue.py

Distributed job queue interface for simulation workers.
Wraps RQ (Redis Queue) to replace the legacy local asyncio.Queue.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
import redis
from rq import Retry
from rq import Queue

from app.ingest.normalizer import EarthquakeEvent, event_to_payload
from app.jobs.rq_worker import run_simulation_job
from app.models.simulation_job_repository import create_simulation_job, mark_simulation_job_failed
from app.services.redis_client import redis_manager

logger = logging.getLogger("hazardmap.queue")

AUTO_QUEUE_NAME = "hazard_auto"
MANUAL_QUEUE_NAME = "hazard_manual"
AUTO_BACKPRESSURE_DEPTH = 500
MANUAL_BACKPRESSURE_DEPTH = 200

class SimulationQueue:
    def __init__(self):
        self._rq_queues = {}
        self._redis_conn = None

    def _get_rq_queue(self, name: str = AUTO_QUEUE_NAME) -> Queue:
        if name not in self._rq_queues:
            # RQ requires a synchronous redis connection
            # We derive the URL from our shared redis_manager
            url = redis_manager.url if hasattr(redis_manager, 'url') else "redis://localhost:6379"
            if self._redis_conn is None:
                self._redis_conn = redis.Redis.from_url(url)
            self._rq_queues[name] = Queue(name, connection=self._redis_conn)
        return self._rq_queues[name]

    def put_nowait(self, event: EarthquakeEvent) -> None:
        """
        Maintains backwards compatibility with asyncio.Queue.put_nowait()
        Synchronous push to Redis. (Sub-millisecond, safe for event loop).
        """
        if not redis_manager._is_connected:
            raise asyncio.QueueFull("Redis is unavailable; simulation job was not queued.")

        try:
            q = self._get_rq_queue(AUTO_QUEUE_NAME)

            if q.count >= AUTO_BACKPRESSURE_DEPTH and event.magnitude < 5.5:
                logger.error(f"[Queue] Backpressure triggered! Dropping event {event.source_id}. Queue is at capacity.")
                raise asyncio.QueueFull("Auto simulation queue is at capacity.")
            
            # Serialize the event object to a raw dict for RQ Pickling compatibility
            event_dict = event_to_payload(event)
            event_dict["db_id"] = event.db_id
            event_dict["enqueued_at"] = time.time()
            
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

    def enqueue_manual(
        self,
        *,
        latitude: float,
        longitude: float,
        magnitude: float,
        depth_km: float,
        gmpe_params: dict | None = None,
    ) -> str:
        if not redis_manager._is_connected:
            raise asyncio.QueueFull("Redis is unavailable; manual simulation job was not queued.")

        request_id = f"manual:{uuid.uuid4().hex}"
        payload = {
            "kind": "manual",
            "request_id": request_id,
            "latitude": latitude,
            "longitude": longitude,
            "magnitude": magnitude,
            "depth_km": depth_km,
            "gmpe_params": gmpe_params,
            "source_id": request_id,
            "source": "manual",
            "enqueued_at": time.time(),
        }

        try:
            q = self._get_rq_queue(MANUAL_QUEUE_NAME)
            if q.count >= MANUAL_BACKPRESSURE_DEPTH:
                raise asyncio.QueueFull("Manual simulation queue is at capacity.")

            create_simulation_job(request_id, payload)

            q.enqueue(
                run_simulation_job,
                payload,
                job_id=request_id,
                job_timeout=300,
                result_ttl=0,
                failure_ttl=86400,
                ttl=3600,
                retry=Retry(max=1, interval=[30]),
            )
            logger.debug("[Queue] Enqueued manual simulation: %s", request_id)
            return request_id
        except Exception as exc:
            logger.error("[Queue] Failed to enqueue manual simulation: %s", exc)
            try:
                mark_simulation_job_failed(request_id, str(exc))
            except Exception:
                logger.exception("[Queue] Could not mark manual simulation %s as failed.", request_id)
            raise asyncio.QueueFull(f"Redis RQ unavailable: {exc}") from exc

    def qsize(self) -> int:
        try:
            if not redis_manager._is_connected:
                return 0
            return self._get_rq_queue(AUTO_QUEUE_NAME).count + self._get_rq_queue(MANUAL_QUEUE_NAME).count
        except Exception:
            return 0


# Shared singleton instance
_queue = SimulationQueue()

def get_queue() -> SimulationQueue:
    return _queue

async def enqueue(event: EarthquakeEvent) -> None:
    """Async wrapper for putting events onto the RQ."""
    await asyncio.to_thread(_queue.put_nowait, event)
