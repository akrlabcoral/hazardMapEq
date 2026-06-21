"""Earthquake-specific model aliases.

The ingest event dataclass remains in ``app.ingest.normalizer`` for backward
compatibility with existing workers and tests.
"""
from __future__ import annotations

from app.ingest.normalizer import EarthquakeEvent

__all__ = ["EarthquakeEvent"]

