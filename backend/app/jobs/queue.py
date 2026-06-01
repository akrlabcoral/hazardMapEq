"""
app/jobs/queue.py

asyncio.Queue + single worker loop for auto-triggered simulations.

Worker design:
  - Dequeues one EarthquakeEvent at a time
  - Runs SimulationRunner.run() via asyncio.to_thread() — CRITICAL:
    matplotlib's contourf is synchronous and takes 2-3s. Without to_thread(),
    it blocks the entire event loop (WebSocket pings drop, poller stalls).
  - Broadcasts result to all WebSocket clients on success
  - Marks event as simulated/failed in PostgreSQL
  - Never crashes — exceptions are caught and logged
"""
from __future__ import annotations

import asyncio
import logging

from app.ingest.normalizer import EarthquakeEvent
from app.jobs.simulation_worker import SimulationRunner
from app.models.repository import mark_event_simulated, mark_event_sim_failed

logger = logging.getLogger("hazardmap.queue")

# ---------------------------------------------------------------------------
# Shared queue — poller puts events in, worker takes them out
# ---------------------------------------------------------------------------
_queue: asyncio.Queue[EarthquakeEvent] = asyncio.Queue(maxsize=500)


def get_queue() -> asyncio.Queue:
    return _queue


async def enqueue(event: EarthquakeEvent) -> None:
    await _queue.put(event)


# ---------------------------------------------------------------------------
# Worker loop — run as asyncio.create_task() in main.py lifespan
# ---------------------------------------------------------------------------
async def run_worker() -> None:
    """
    Infinite worker loop. Start with asyncio.create_task(run_worker()).
    Imports broadcast lazily to avoid circular imports (ws.py ↔ queue.py).
    """
    from app.api.ws import broadcast  # lazy import — avoids circular dependency

    logger.info("[Worker] Simulation worker started.")

    while True:
        event: EarthquakeEvent = await _queue.get()
        logger.info(
            f"[Worker] Dequeued: source_id={event.source_id} "
            f"mag={event.magnitude} place={event.place!r}"
        )

        try:
            # Broadcast "simulation running" before starting
            await broadcast({
                "type":     "simulation_running",
                "event_id": event.db_id,
                "event": {
                    "magnitude": event.magnitude,
                    "latitude":  event.latitude,
                    "longitude": event.longitude,
                    "place":     event.place,
                },
            })

            # Run in thread — keeps event loop free during matplotlib contour gen
            result = await asyncio.to_thread(
                SimulationRunner.run,
                event.latitude,
                event.longitude,
                event.magnitude,
                event.depth_km,
                None,           # use default GMPE params for auto-triggered events
                event.db_id,
                "auto_usgs",
            )

            # Broadcast complete result to all browser clients
            await broadcast({
                "type":          "simulation_complete",
                "event_id":      event.db_id,
                "simulation_id": result["simulation_id"],
                "simulation":    result,
            })

            # Mark in DB
            if event.db_id is not None:
                mark_event_simulated(event.db_id, result["simulation_id"])

            logger.info(
                f"[Worker] Done: sim_id={result['simulation_id']} "
                f"event_id={event.db_id}"
            )

        except Exception as exc:
            logger.exception(f"[Worker] Simulation FAILED for {event.source_id}: {exc}")
            if event.db_id is not None:
                mark_event_sim_failed(event.db_id, str(exc))
            await broadcast({
                "type":     "simulation_error",
                "event_id": event.db_id,
                "error":    str(exc),
            })

        finally:
            _queue.task_done()
