"""
app/ingest/poller.py

Async background tasks that poll USGS and NCS earthquake feeds every 60 seconds.
Runs inside the FastAPI process as asyncio tasks — no separate worker process needed.

Pipeline per cycle:
  fetch → normalize → validate → deduplicate → filter → enqueue
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import aiohttp

from app.ingest.normalizer import normalize_usgs_feature, is_valid, EarthquakeEvent
from app.ingest import deduplicator
from app.ingest.filter import is_relevant
from app.ingest.ncs_scraper import fetch_ncs_events
from app.models.repository import save_earthquake_event

logger = logging.getLogger("hazardmap.poller")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
POLL_INTERVAL_SECONDS = 60

USGS_FEEDS = [
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/1.0_hour.geojson",  # fallback
]

# Shared state — read by GET /api/health
poller_stats: dict = {
    "last_poll_utc":    None,
    "last_event_count": 0,
    "consecutive_failures": 0,
    "status": "starting",
}


# ---------------------------------------------------------------------------
# HTTP fetch with retry + fallback URL
# ---------------------------------------------------------------------------
async def _fetch_feed(session: aiohttp.ClientSession) -> dict | None:
    """Try each USGS URL in order. Returns parsed JSON or None on total failure."""
    for url in USGS_FEEDS:
        for attempt in range(3):
            try:
                timeout = aiohttp.ClientTimeout(total=15.0)
                async with session.get(url, timeout=timeout) as resp:
                    resp.raise_for_status()
                    data = await resp.json(content_type=None)
                    poller_stats["consecutive_failures"] = 0
                    return data
            except asyncio.TimeoutError:
                logger.warning(f"[Poller] Timeout on {url} attempt {attempt+1}/3")
                await asyncio.sleep(5 * (attempt + 1))
            except aiohttp.ClientError as e:
                logger.warning(f"[Poller] Network error on {url}: {e}")
                await asyncio.sleep(10)
        logger.warning(f"[Poller] All 3 attempts failed for {url}, trying next feed...")

    poller_stats["consecutive_failures"] += 1
    logger.error(f"[Poller] All feeds failed. Consecutive failures: {poller_stats['consecutive_failures']}")
    return None


# ---------------------------------------------------------------------------
# Shared event processing pipeline (used by both USGS and NCS cycles)
# ---------------------------------------------------------------------------
def _process_event(
    event: EarthquakeEvent,
    queue: asyncio.Queue,
    log_prefix: str,
) -> tuple[bool, bool]:
    """
    Run the dedup → persist → filter → enqueue pipeline for a single event.

    Returns:
        (is_new, was_queued) — both True means a new, India-relevant event was enqueued.
    """
    # 1. Deduplicate (PostgreSQL-backed)
    if deduplicator.is_seen(event):
        return False, False
    deduplicator.record(event)

    # 2. Persist to earthquake_events table
    event.db_id = save_earthquake_event(event)

    # 3. Filter — only India-relevant events go to simulation
    if not is_relevant(event):
        return True, False

    # 4. Enqueue for simulation
    try:
        queue.put_nowait(event)
        logger.info(
            "[%s] Queued event: source_id=%s mag=%s place=%r",
            log_prefix, event.source_id, event.magnitude, event.place,
        )
        return True, True
    except asyncio.QueueFull:
        logger.warning("[%s] Queue full — dropping event %s", log_prefix, event.source_id)
        return True, False


# ---------------------------------------------------------------------------
# One USGS poll cycle
# ---------------------------------------------------------------------------
async def _poll_cycle(queue: asyncio.Queue) -> None:
    """Execute a single USGS poll → normalize → dedup → filter → enqueue cycle."""
    t_start = time.monotonic()

    async with aiohttp.ClientSession() as session:
        data = await _fetch_feed(session)

    if data is None:
        poller_stats["status"] = "error"
        return

    features = data.get("features", [])
    n_fetched = len(features)
    n_new = 0
    n_queued = 0

    for feature in features:
        # 1. Normalize USGS GeoJSON feature into EarthquakeEvent
        event = normalize_usgs_feature(feature)
        if event is None:
            continue

        # 2. Validate physical parameters
        if not is_valid(event):
            continue

        is_new, was_queued = _process_event(event, queue, "Poller")
        if is_new:
            n_new += 1
        if was_queued:
            n_queued += 1

    duration_ms = int((time.monotonic() - t_start) * 1000)
    poller_stats.update({
        "last_poll_utc":    datetime.now(tz=timezone.utc).isoformat(),
        "last_event_count": n_fetched,
        "status":           "ok",
    })
    logger.info(
        "[Poller] cycle: fetched=%d new=%d queued=%d duration_ms=%d",
        n_fetched, n_new, n_queued, duration_ms,
    )


# ---------------------------------------------------------------------------
# Main USGS poller loop — run as asyncio.create_task() in main.py lifespan
# ---------------------------------------------------------------------------
async def run_poller(queue: asyncio.Queue) -> None:
    """
    Infinite loop that polls USGS every POLL_INTERVAL_SECONDS.
    Designed to be started with asyncio.create_task().
    """
    logger.info("[Poller] Starting USGS poller (interval=%ds)", POLL_INTERVAL_SECONDS)
    poller_stats["status"] = "running"

    while True:
        try:
            await _poll_cycle(queue)
        except Exception as e:
            logger.exception("[Poller] Unexpected error in poll cycle: %s", e)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# One NCS poll cycle
# ---------------------------------------------------------------------------
async def _poll_ncs_cycle(queue: asyncio.Queue) -> None:
    """Execute a single NCS poll → validate → dedup → filter → enqueue cycle."""
    t_start = time.monotonic()

    async with aiohttp.ClientSession() as session:
        events = await fetch_ncs_events(session)

    if not events:
        return

    n_fetched = len(events)
    n_new = 0
    n_queued = 0

    for event in events:
        # Validate physical parameters (NCS events are already normalized by the scraper)
        if not is_valid(event):
            continue

        is_new, was_queued = _process_event(event, queue, "NCS Poller")
        if is_new:
            n_new += 1
        if was_queued:
            n_queued += 1

    duration_ms = int((time.monotonic() - t_start) * 1000)
    logger.info(
        "[NCS Poller] cycle: fetched=%d new=%d queued=%d duration_ms=%d",
        n_fetched, n_new, n_queued, duration_ms,
    )


# ---------------------------------------------------------------------------
# NCS poller loop — run as asyncio.create_task() in main.py lifespan
# ---------------------------------------------------------------------------
async def run_ncs_poller(queue: asyncio.Queue) -> None:
    """
    Infinite loop that polls NCS every POLL_INTERVAL_SECONDS.
    Designed to be started with asyncio.create_task().
    """
    logger.info("[NCS Poller] Starting NCS scraper (interval=%ds)", POLL_INTERVAL_SECONDS)
    while True:
        try:
            await _poll_ncs_cycle(queue)
        except Exception as e:
            logger.exception("[NCS Poller] Unexpected error in NCS poll cycle: %s", e)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)
