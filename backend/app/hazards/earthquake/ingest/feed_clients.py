from __future__ import annotations

import asyncio
import logging

import aiohttp

from app.hazards.earthquake.ingest.ncs_scraper import fetch_ncs_events

logger = logging.getLogger("hazardmap.feed_clients")

USGS_FEEDS = [
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/1.0_hour.geojson",
]


async def fetch_usgs_feed(session: aiohttp.ClientSession, stats: dict) -> dict | None:
    for url in USGS_FEEDS:
        for attempt in range(3):
            try:
                timeout = aiohttp.ClientTimeout(total=15.0)
                async with session.get(url, timeout=timeout) as resp:
                    resp.raise_for_status()
                    data = await resp.json(content_type=None)
                    stats["consecutive_failures"] = 0
                    return data
            except asyncio.TimeoutError:
                logger.warning("[Poller] Timeout on %s attempt %d/3", url, attempt + 1)
                await asyncio.sleep(5 * (attempt + 1))
            except aiohttp.ClientError as exc:
                logger.warning("[Poller] Network error on %s: %s", url, exc)
                await asyncio.sleep(10)
        logger.warning("[Poller] All 3 attempts failed for %s, trying next feed...", url)

    stats["consecutive_failures"] += 1
    logger.error("[Poller] All feeds failed. Consecutive failures: %s", stats["consecutive_failures"])
    return None


async def fetch_ncs_feed(session: aiohttp.ClientSession):
    return await fetch_ncs_events(session)
