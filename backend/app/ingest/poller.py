"""
app/ingest/poller.py

Async background task that polls the USGS earthquake feed every 60 seconds.
Runs inside the FastAPI process as an asyncio task — no separate worker process needed.

Pipeline per cycle:
  fetch → normalize → validate → deduplicate → filter → enqueue
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import aiohttp

from app.ingest.normalizer import normalize_usgs_feature, is_valid
from app.ingest import deduplicator
from app.ingest.filter import is_relevant
from app.models.repository import save_earthquake_event

logger = logging.getLogger("hazardmap.poller")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
POLL_INTERVAL_SECONDS = 60

USGS_FEEDS = [
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_hour.geojson",  # fallback
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
# One poll cycle
# ---------------------------------------------------------------------------
async def _poll_cycle(queue: asyncio.Queue) -> None:
    """Execute a single poll → normalize → dedup → filter → enqueue cycle."""
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
        # 1. Normalize
        event = normalize_usgs_feature(feature)
        if event is None:
            continue

        # 2. Validate physical parameters
        if not is_valid(event):
            continue

        # 3. Deduplicate (PostgreSQL-backed)
        if deduplicator.is_seen(event):
            continue
        deduplicator.record(event)
        n_new += 1

        # 4. Persist to earthquake_events table
        event.db_id = save_earthquake_event(event)

        # 5. Filter — only India-relevant events go to simulation
        if not is_relevant(event):
            continue

        # 6. Enqueue for simulation
        try:
            queue.put_nowait(event)
            n_queued += 1
            logger.info(
                f"[Poller] Queued event: source_id={event.source_id} "
                f"mag={event.magnitude} place={event.place!r}"
            )
        except asyncio.QueueFull:
            logger.warning(f"[Poller] Queue full — dropping event {event.source_id}")

    duration_ms = int((time.monotonic() - t_start) * 1000)
    poller_stats.update({
        "last_poll_utc":    datetime.now(tz=timezone.utc).isoformat(),
        "last_event_count": n_fetched,
        "status":           "ok",
    })
    logger.info(
        f"[Poller] cycle: fetched={n_fetched} new={n_new} "
        f"queued={n_queued} duration_ms={duration_ms}"
    )


# ---------------------------------------------------------------------------
# Main poller loop — run as asyncio.create_task() in main.py lifespan
# ---------------------------------------------------------------------------
async def run_poller(queue: asyncio.Queue) -> None:
    """
    Infinite loop that polls USGS every POLL_INTERVAL_SECONDS.
    Designed to be started with asyncio.create_task().
    """
    logger.info(f"[Poller] Starting USGS poller (interval={POLL_INTERVAL_SECONDS}s)")
    poller_stats["status"] = "running"

    while True:
        try:
            await _poll_cycle(queue)
        except Exception as e:
            logger.exception(f"[Poller] Unexpected error in poll cycle: {e}")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# NCS Poller Loop
# ---------------------------------------------------------------------------
async def _poll_ncs_cycle(queue: asyncio.Queue) -> None:
    """Execute a single NCS poll → normalize → dedup → filter → enqueue cycle."""
    t_start = time.monotonic()
    from app.ingest.ncs_scraper import fetch_ncs_events

    async with aiohttp.ClientSession() as session:
        events = await fetch_ncs_events(session)

    if not events:
        return

    n_fetched = len(events)
    n_new = 0
    n_queued = 0

    for event in events:
        # 2. Validate physical parameters
        if not is_valid(event):
            continue

        # 3. Deduplicate (PostgreSQL-backed)
        if deduplicator.is_seen(event):
            continue
        deduplicator.record(event)
        n_new += 1

        # 4. Persist to earthquake_events table
        event.db_id = save_earthquake_event(event)

        # 5. Filter — only India-relevant events go to simulation
        if not is_relevant(event):
            continue

        # 6. Enqueue for simulation
        try:
            queue.put_nowait(event)
            n_queued += 1
            logger.info(
                f"[NCS Poller] Queued event: source_id={event.source_id} "
                f"mag={event.magnitude} place={event.place!r}"
            )
        except asyncio.QueueFull:
            logger.warning(f"[NCS Poller] Queue full — dropping event {event.source_id}")

    duration_ms = int((time.monotonic() - t_start) * 1000)
    logger.info(
        f"[NCS Poller] cycle: fetched={n_fetched} new={n_new} "
        f"queued={n_queued} duration_ms={duration_ms}"
    )


async def run_ncs_poller(queue: asyncio.Queue) -> None:
    """
    Infinite loop that polls NCS every POLL_INTERVAL_SECONDS.
    """
    logger.info(f"[NCS Poller] Starting NCS scraper (interval={POLL_INTERVAL_SECONDS}s)")
    while True:
        try:
            await _poll_ncs_cycle(queue)
        except Exception as e:
            logger.exception(f"[NCS Poller] Unexpected error in NCS poll cycle: {e}")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)
