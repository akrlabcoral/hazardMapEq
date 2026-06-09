"""
Async background tasks that poll USGS and NCS earthquake feeds.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import aiohttp

from app.config import settings
from app.ingest.feed_clients import fetch_ncs_feed, fetch_usgs_feed
from app.ingest.normalizer import is_valid, normalize_usgs_feature
from app.ingest.processor import process_event

logger = logging.getLogger("hazardmap.poller")

POLL_INTERVAL_SECONDS = settings.usgs_poll_interval_seconds
NCS_POLL_INTERVAL_SECONDS = settings.ncs_poll_interval_seconds

poller_stats: dict = {
    "last_poll_utc": None,
    "last_event_count": 0,
    "consecutive_failures": 0,
    "status": "starting",
}


async def _poll_cycle(queue: asyncio.Queue) -> None:
    t_start = time.monotonic()

    async with aiohttp.ClientSession() as session:
        data = await fetch_usgs_feed(session, poller_stats)

    if data is None:
        poller_stats["status"] = "error"
        return

    features = data.get("features", [])
    n_fetched = len(features)
    n_new = 0
    n_queued = 0

    for feature in features:
        event = normalize_usgs_feature(feature)
        if event is None or not is_valid(event):
            continue

        is_new, was_queued = await process_event(event, queue, "Poller")
        n_new += int(is_new)
        n_queued += int(was_queued)

    duration_ms = int((time.monotonic() - t_start) * 1000)
    poller_stats.update({
        "last_poll_utc": datetime.now(tz=timezone.utc).isoformat(),
        "last_event_count": n_fetched,
        "status": "ok",
    })
    logger.info(
        "[Poller] cycle: fetched=%d new=%d queued=%d duration_ms=%d",
        n_fetched,
        n_new,
        n_queued,
        duration_ms,
    )


async def run_poller(queue: asyncio.Queue) -> None:
    logger.info("[Poller] Starting USGS poller (interval=%ds)", POLL_INTERVAL_SECONDS)
    poller_stats["status"] = "running"

    while True:
        try:
            await _poll_cycle(queue)
        except Exception as exc:
            logger.exception("[Poller] Unexpected error in poll cycle: %s", exc)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def _poll_ncs_cycle(queue: asyncio.Queue) -> None:
    t_start = time.monotonic()

    async with aiohttp.ClientSession() as session:
        events = await fetch_ncs_feed(session)

    if not events:
        return

    n_fetched = len(events)
    n_new = 0
    n_queued = 0

    for event in events:
        if not is_valid(event):
            continue

        is_new, was_queued = await process_event(event, queue, "NCS Poller")
        n_new += int(is_new)
        n_queued += int(was_queued)

    duration_ms = int((time.monotonic() - t_start) * 1000)
    logger.info(
        "[NCS Poller] cycle: fetched=%d new=%d queued=%d duration_ms=%d",
        n_fetched,
        n_new,
        n_queued,
        duration_ms,
    )


async def run_ncs_poller(queue: asyncio.Queue) -> None:
    logger.info("[NCS Poller] Starting NCS scraper (interval=%ds)", NCS_POLL_INTERVAL_SECONDS)
    while True:
        try:
            await _poll_ncs_cycle(queue)
        except Exception as exc:
            logger.exception("[NCS Poller] Unexpected error in NCS poll cycle: %s", exc)
        await asyncio.sleep(NCS_POLL_INTERVAL_SECONDS)
