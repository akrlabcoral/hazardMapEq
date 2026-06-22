"""Shared boundary compatibility helpers."""
from __future__ import annotations

from app.shared.gis.boundary_service import boundary_service, get_india_geom, is_epicenter_valid


class _BufferedIndiaProxy:
    def __getattr__(self, name: str):
        return getattr(boundary_service.get_buffered_geometry(), name)

    def contains(self, *args, **kwargs):
        return boundary_service.get_buffered_geometry().contains(*args, **kwargs)


BUFFERED_INDIA = _BufferedIndiaProxy()

__all__ = ["BUFFERED_INDIA", "boundary_service", "get_india_geom", "is_epicenter_valid"]
