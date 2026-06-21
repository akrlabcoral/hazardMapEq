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

from app.api.common.health import router as health_router
from app.api.router import router as api_router
from app.api.ws import redis_listener
from app.config import settings
from app.core.database import close_pool, init_db, init_pool
from app.core.logging import configure_logging
from app.shared.cache import raster_cache
from app.shared.gis.raster_loader import load_all_soil_rasters
from app.ingest.poller import run_poller, run_ncs_poller
from app.jobs.queue import get_queue
from app.jobs.simulation_worker import SimulationRunner
from app.services.background_tasks import BackgroundTaskManager
from app.services.cleanup_scheduler import run_daily_cleanup
from app.services.recovery import recover_unsimulated_events
from app.services.redis_client import redis_manager


configure_logging(logging.INFO)
logger = logging.getLogger("hazardmap.main")

_background_tasks = BackgroundTaskManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────
    await redis_manager.connect()
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
    _background_tasks.start(redis_listener, "redis_ws_listener")
    _background_tasks.start(run_daily_cleanup, "db_cleanup")
    logger.info("[Startup] USGS poller, NCS poller, and daily cleanup started.")

    # Startup recovery: re-enqueue events that were ingested but not simulated
    # (Only one container will execute this due to distributed lock)
    await recover_unsimulated_events(queue)

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    await _background_tasks.stop_all()

    logger.info("[Shutdown] Closing soil raster handles...")
    raster_cache.close_all()

    logger.info("[Shutdown] Closing DB connection pool...")
    close_pool()
    await redis_manager.disconnect()


app = FastAPI(
    title="HazardMap Scientific Earthquake Engine",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type", "If-None-Match"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(api_router, prefix="/api")
app.include_router(health_router)
if settings.enable_dev_routes:
    from app.api import dev as dev_module
    app.include_router(dev_module.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
