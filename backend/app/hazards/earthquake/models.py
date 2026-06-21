"""Earthquake-specific model aliases.

The ingest event dataclass remains in ``app.hazards.earthquake.ingest.normalizer`` for backward
compatibility with existing workers and tests.
"""
from __future__ import annotations

from app.hazards.earthquake.ingest.normalizer import EarthquakeEvent

__all__ = ["EarthquakeEvent"]

