"""
app/ingest/filter.py

Relevance filter — only pass events that are:
  1. M >= MIN_MAGNITUDE (currently 0.0 — ingests all magnitudes including micro-tremors)
     Raise to 4.0 to suppress low-significance events and reduce simulation load.
  2. Within India's buffered boundary (9-degree buffer = ~1000 km)
  3. Depth <= 300 km (very deep events have diffuse surface impact)

Reuses BUFFERED_INDIA from app/gis/boundary.py which is already loaded at startup.
"""
from __future__ import annotations

from shapely.geometry import Point

from app.ingest.normalizer import EarthquakeEvent
from app.config import settings
from app.gis.boundary import BUFFERED_INDIA

MIN_MAGNITUDE = settings.auto_sim_min_magnitude
MAX_DEPTH_KM  = settings.auto_sim_max_depth_km


def is_relevant(event: EarthquakeEvent) -> bool:
    """Return True if this event should trigger a simulation."""
    if event.magnitude < MIN_MAGNITUDE:
        return False
    if event.depth_km > MAX_DEPTH_KM:
        return False
    point = Point(event.longitude, event.latitude)
    return BUFFERED_INDIA.contains(point)
