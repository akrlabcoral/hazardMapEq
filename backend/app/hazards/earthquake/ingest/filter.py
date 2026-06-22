"""
app/hazards/earthquake/ingest/filter.py

Relevance filter — only pass events that are:
  1. M >= MIN_MAGNITUDE (currently 0.0 — ingests all magnitudes including micro-tremors)
     Raise to 4.0 to suppress low-significance events and reduce simulation load.
  2. Within India's buffered boundary (1.8-degree buffer = ~200 km)
  3. Depth <= 300 km (very deep events have diffuse surface impact)

Reuses buffered India boundary geometry loaded at startup.
"""
from __future__ import annotations

from app.hazards.earthquake.ingest.normalizer import EarthquakeEvent
from app.config import settings
from app.shared.gis.boundary_service import boundary_service

MIN_MAGNITUDE = settings.auto_sim_min_magnitude
MAX_DEPTH_KM  = settings.auto_sim_max_depth_km


def is_relevant(event: EarthquakeEvent) -> bool:
    """Return True if this event should trigger a simulation."""
    if event.magnitude < MIN_MAGNITUDE:
        return False
    if event.depth_km > MAX_DEPTH_KM:
        return False
    return boundary_service.contains_supported_epicenter(event.latitude, event.longitude)
