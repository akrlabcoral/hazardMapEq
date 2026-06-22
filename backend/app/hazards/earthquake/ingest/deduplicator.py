"""
app/hazards/earthquake/ingest/deduplicator.py

PostgreSQL-backed event deduplication.
No Redis required — uses the existing `dedup_cache` table.

Two levels:
  Level 1: source_id   — exact match ("usgs:us7000mxyz")
  Level 2: fingerprint — spatial-temporal hash (cross-source dedup for future)
"""
from __future__ import annotations

from app.hazards.earthquake.repository import is_duplicate, mark_seen, try_mark_seen
from app.hazards.earthquake.ingest.normalizer import EarthquakeEvent


def is_seen(event: EarthquakeEvent) -> bool:
    """Returns True if this event (or a spatial-temporal duplicate) was already processed."""
    return is_duplicate(event.source_id, event.fingerprint)


def record(event: EarthquakeEvent) -> None:
    """Mark both source_id and fingerprint as seen in the dedup cache."""
    mark_seen(event.source_id, event.fingerprint)


def try_record(event: EarthquakeEvent) -> bool:
    """Atomically mark the event as seen; returns False if it was already processed."""
    return try_mark_seen(event.source_id, event.fingerprint)
