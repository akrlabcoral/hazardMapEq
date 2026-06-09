from __future__ import annotations

import asyncio
import logging

from app.ingest.normalizer import EarthquakeEvent
from app.models.repository import get_unsimulated_events

logger = logging.getLogger("hazardmap.recovery")


def recover_unsimulated_events(queue: asyncio.Queue, minutes: int = 30) -> int:
    try:
        pending = get_unsimulated_events(minutes=minutes)
    except Exception as exc:
        logger.warning("[Startup] Could not query unsimulated events: %s", exc)
        return 0

    if not pending:
        logger.info("[Startup] No unsimulated events to recover.")
        return 0

    recovered = 0
    logger.info("[Startup] Recovering %d unsimulated event(s)...", len(pending))
    for row in pending:
        try:
            event = EarthquakeEvent(
                source_id=row["source_id"],
                source=row["source"],
                fingerprint=row.get("fingerprint", ""),
                latitude=row["latitude"],
                longitude=row["longitude"],
                depth_km=row["depth_km"],
                magnitude=row["magnitude"],
                mag_type=row.get("mag_type", "Mw"),
                origin_time=row["origin_time"],
                place=row.get("place") or "Unknown location",
                status=row.get("status") or "automatic",
                alert_level=row.get("alert_level"),
            )
            event.db_id = row["id"]
            queue.put_nowait(event)
            recovered += 1
        except Exception as exc:
            logger.warning("[Startup] Could not recover event id=%s: %s", row.get("id"), exc)

    logger.info("[Startup] Recovery complete: %d/%d event(s) re-queued.", recovered, len(pending))
    return recovered
