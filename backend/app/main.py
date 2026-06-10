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

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import simulate
from app.api import ws as ws_module
from app.api import events as events_module
from app.api import dev as dev_module
from app.api import historic as historic_module
from app.config import settings
from app.soil import cache as soil_cache
from app.soil.loader import load_all_soil_rasters
from app.models.repository import close_pool, init_db, init_pool
from app.ingest.poller import run_poller, run_ncs_poller
from app.jobs.queue import run_worker, get_queue
from app.jobs.simulation_worker import SimulationRunner
from app.services.background_tasks import BackgroundTaskManager
from app.services.cleanup_scheduler import run_daily_cleanup
from app.services.recovery import recover_unsimulated_events


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("hazardmap.main")

_background_tasks = BackgroundTaskManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────
    logger.info("[Startup] Initializing database...")
    init_pool()
    init_db()
    logger.info("[Startup] Database ready.")

    logger.info("[Startup] Loading soil rasters...")
    load_all_soil_rasters()
    logger.info("[Startup] Soil raster loading complete.")

    logger.info("[Startup] Loading simulation grid context...")
    SimulationRunner.initialize_default()
    logger.info("[Startup] Simulation grid context ready.")

    queue = get_queue()

    # Start background tasks
    _background_tasks.start(lambda: run_poller(queue), "usgs_poller")
    _background_tasks.start(lambda: run_ncs_poller(queue), "ncs_poller")
    _background_tasks.start(run_worker, "sim_worker")
    _background_tasks.start(run_daily_cleanup, "db_cleanup")
    logger.info("[Startup] USGS poller, NCS poller, simulation worker, and daily cleanup started.")

    # Startup recovery: re-enqueue events that were ingested but not simulated
    # before the last crash or container restart.
    recover_unsimulated_events(queue)

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    await _background_tasks.stop_all()

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
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(simulate.router,       prefix="/api")
app.include_router(ws_module.router,      prefix="/api")
app.include_router(events_module.router,  prefix="/api")
app.include_router(dev_module.router,     prefix="/api")
app.include_router(historic_module.router, prefix="/api/historic")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
