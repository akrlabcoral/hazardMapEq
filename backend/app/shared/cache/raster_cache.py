"""Shared raster cache compatibility helpers."""
from __future__ import annotations

from app.soil.cache import close_all, get_all_states, get_bounds_registry, register, sample_points

__all__ = ["close_all", "get_all_states", "get_bounds_registry", "register", "sample_points"]
