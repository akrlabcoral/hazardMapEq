"""
app/main.py

FastAPI application entry point.

Lifespan manages:
  - Soil raster preloading
  - USGS poller asyncio task
  - Simulation worker asyncio task
  - Daily DB cleanup task
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
from app.soil import cache as soil_cache
from app.soil.loader import load_all_soil_rasters
from app.models.repository import close_pool, cleanup_old_data
from app.ingest.poller import run_poller, run_ncs_poller
from app.jobs.queue import run_worker, get_queue


async def _run_daily_cleanup() -> None:
    """Runs cleanup_old_data() every 24 hours in the background."""
    while True:
        await asyncio.sleep(24 * 60 * 60)  # wait 24 hours before first run
        try:
            await asyncio.to_thread(cleanup_old_data)
            logger.info("[Cleanup] Daily DB cleanup complete.")
        except Exception as exc:
            logger.warning("[Cleanup] DB cleanup failed — %s", exc)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("hazardmap.main")

_bg_tasks: list[asyncio.Task] = []


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

from app.api import tests as tests_module
app.include_router(tests_module.router,   prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
