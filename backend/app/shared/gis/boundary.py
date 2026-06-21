"""Shared boundary helpers.

The current authoritative implementation lives in ``app.gis.boundary``. This
module gives hazard packages a neutral import path while preserving behavior.
"""
from __future__ import annotations

from app.gis.boundary import BUFFERED_INDIA, get_india_geom, is_epicenter_valid

__all__ = ["BUFFERED_INDIA", "get_india_geom", "is_epicenter_valid"]
