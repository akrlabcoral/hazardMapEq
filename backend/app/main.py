"""
app/main.py

FastAPI application entry point.

Lifespan manages:
  - Soil raster preloading
  - USGS poller asyncio task
  - NCS poller asyncio task
  - Simulation worker asyncio task
  - Daily DB cleanup task
  - Startup recovery for unsimulated events
  - DB connection pool shutdown
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import simulate
from app.api import ws as ws_module
from app.api import events as events_module
from app.api import tests as tests_module
from app.soil import cache as soil_cache
from app.soil.loader import load_all_soil_rasters
from app.models.repository import close_pool, cleanup_old_data, get_unsimulated_events
from app.ingest.poller import run_poller, run_ncs_poller
from app.jobs.queue import run_worker, get_queue


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("hazardmap.main")

_bg_tasks: list[asyncio.Task] = []


async def _run_daily_cleanup() -> None:
    """Runs cleanup_old_data() every 24 hours in the background."""
    while True:
        await asyncio.sleep(24 * 60 * 60)  # wait 24 hours before first run
        try:
            await asyncio.to_thread(cleanup_old_data)
            logger.info("[Cleanup] Daily DB cleanup complete.")
        except Exception as exc:
            logger.warning("[Cleanup] DB cleanup failed — %s", exc)


def _recover_unsimulated_events() -> None:
    """
    Re-enqueue events ingested in the last 30 minutes that were never simulated.
    Handles crashes and container restarts mid-flight — ensures no event is lost.
    """
    from app.ingest.normalizer import EarthquakeEvent

    try:
        pending = get_unsimulated_events(minutes=30)
    except Exception as exc:
        logger.warning("[Startup] Could not query unsimulated events: %s", exc)
        return

    if not pending:
        logger.info("[Startup] No unsimulated events to recover.")
        return

    logger.info("[Startup] Recovering %d unsimulated event(s)...", len(pending))
    queue = get_queue()
    recovered = 0
    for row in pending:
        try:
            event = EarthquakeEvent(
                source_id   = row["source_id"],
                source      = row["source"],
                magnitude   = row["magnitude"],
                depth_km    = row["depth_km"],
                latitude    = row["latitude"],
                longitude   = row["longitude"],
                place       = row["place"],
                origin_time = row["origin_time"],
                mag_type    = row.get("mag_type", "Mw"),
                fingerprint = row.get("fingerprint", ""),
            )
            event.db_id = row["id"]
            queue.put_nowait(event)
            recovered += 1
        except Exception as exc:
            logger.warning("[Startup] Could not recover event id=%s: %s", row.get("id"), exc)

    logger.info("[Startup] Recovery complete — %d/%d event(s) re-queued.", recovered, len(pending))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────
    logger.info("[Startup] Loading soil rasters...")
    load_all_soil_rasters()
    logger.info("[Startup] Soil raster loading complete.")

    queue = get_queue()

    # Start background tasks
    usgs_poller_task = asyncio.create_task(run_poller(queue),      name="usgs_poller")
    ncs_poller_task  = asyncio.create_task(run_ncs_poller(queue),  name="ncs_poller")
    worker_task      = asyncio.create_task(run_worker(),           name="sim_worker")
    cleanup_task     = asyncio.create_task(_run_daily_cleanup(),   name="db_cleanup")

    _bg_tasks.extend([usgs_poller_task, ncs_poller_task, worker_task, cleanup_task])
    logger.info("[Startup] USGS poller, NCS poller, simulation worker, and daily cleanup started.")

    # Startup recovery: re-enqueue events that were ingested but not simulated
    # before the last crash or container restart.
    _recover_unsimulated_events()

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    logger.info("[Shutdown] Cancelling background tasks...")
    for task in _bg_tasks:
        task.cancel()
    await asyncio.gather(*_bg_tasks, return_exceptions=True)

    logger.info("[Shutdown] Closing soil raster handles...")
    soil_cache.close_all()

    logger.info("[Shutdown] Closing DB connection pool...")
    close_pool()


app = FastAPI(
    title="HazardMap Scientific Earthquake Engine",
    version="3.0.0",
    lifespan=lifespan,
)

# TODO (production): replace allow_origins=["*"] with an explicit origin list.
# Browsers reject credentialed cross-origin requests when the origin is a wildcard.
# Before deploying to staging/production, set CORS_ALLOWED_ORIGINS env var and
# replace allow_origins=["*"] with allow_origins=_CORS_ORIGINS.split(",").
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulate.router,       prefix="/api")
app.include_router(ws_module.router,      prefix="/api")
app.include_router(events_module.router,  prefix="/api")
app.include_router(tests_module.router,   prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
