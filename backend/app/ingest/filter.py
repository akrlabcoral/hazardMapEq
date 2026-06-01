"""
app/ingest/filter.py

Relevance filter — only pass events that are:
  1. M >= 4.0 (meaningful shaking potential)
  2. Within India's buffered boundary (9-degree buffer = ~1000 km)
  3. Depth <= 300 km (very deep events have diffuse surface impact)

Reuses BUFFERED_INDIA from app/gis/boundary.py which is already loaded at startup.
"""
from __future__ import annotations

from shapely.geometry import Point

from app.ingest.normalizer import EarthquakeEvent
from app.gis.boundary import BUFFERED_INDIA

MIN_MAGNITUDE = 4.0
MAX_DEPTH_KM  = 300.0


def is_relevant(event: EarthquakeEvent) -> bool:
    """Return True if this event should trigger a simulation."""
    if event.magnitude < MIN_MAGNITUDE:
        return False
    if event.depth_km > MAX_DEPTH_KM:
        return False
    point = Point(event.longitude, event.latitude)
    return BUFFERED_INDIA.contains(point)
