"""Earthquake ingest facade."""
from __future__ import annotations

from app.ingest.normalizer import EarthquakeEvent, event_to_payload
from app.ingest.processor import process_event

__all__ = ["EarthquakeEvent", "event_to_payload", "process_event"]

