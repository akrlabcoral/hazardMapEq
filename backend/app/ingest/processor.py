from __future__ import annotations

import asyncio
import logging

from app.api.ws import broadcast
from app.ingest import deduplicator
from app.ingest.filter import is_relevant
from app.ingest.normalizer import EarthquakeEvent, event_to_payload
from app.models.repository import save_earthquake_event
from app.models.historic_repository import save_historic_event

logger = logging.getLogger("hazardmap.ingest.processor")


async def process_event(
    event: EarthquakeEvent,
    queue: asyncio.Queue,
    log_prefix: str,
) -> tuple[bool, bool]:
    if deduplicator.is_seen(event):
        return False, False
    deduplicator.record(event)

    event.db_id = save_earthquake_event(event)

    if event.magnitude >= 4.0:
        save_historic_event(event)

    relevant = is_relevant(event)
    payload = event_to_payload(event)
    payload["is_relevant"] = relevant

    await broadcast({
        "type": "earthquake_detected",
        "event": payload,
    })

    if not relevant:
        return True, False

    try:
        queue.put_nowait(event)
        logger.info(
            "[%s] Queued event: source_id=%s mag=%s place=%r",
            log_prefix,
            event.source_id,
            event.magnitude,
            event.place,
        )
        return True, True
    except asyncio.QueueFull:
        logger.warning("[%s] Queue full; dropping event %s", log_prefix, event.source_id)
        return True, False
