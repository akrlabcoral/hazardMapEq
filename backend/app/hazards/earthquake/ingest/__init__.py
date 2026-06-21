"""Earthquake ingest facade."""
from __future__ import annotations

from app.hazards.earthquake.ingest.normalizer import EarthquakeEvent, event_to_payload
from app.hazards.earthquake.ingest.poller import poller_stats, run_ncs_poller, run_poller
from app.hazards.earthquake.ingest.processor import process_event

__all__ = [
    "EarthquakeEvent",
    "event_to_payload",
    "poller_stats",
    "process_event",
    "run_ncs_poller",
    "run_poller",
]
