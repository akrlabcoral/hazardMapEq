"""Shared coastline vector service.

Coastline data is optional.  Future tsunami, cyclone, and flood hazards can use
this service without adding new GIS loading infrastructure.
"""
from __future__ import annotations

import threading
from typing import Any

from shapely.geometry import shape
from shapely.ops import unary_union

from app.config import settings
from app.shared.gis.vector_loader import LazyGeoJSONResource


class CoastlineService:
    def __init__(self, path: str | None = None) -> None:
        self._vector = LazyGeoJSONResource("coastline", path if path is not None else settings.coastline_vector_path)
        self._lock = threading.RLock()
        self._geometry = None

    def is_available(self) -> bool:
        return self._vector.is_available()

    def get_geojson(self) -> dict[str, Any] | None:
        return self._vector.get_data()

    def get_geometry(self):
        with self._lock:
            if self._geometry is not None:
                return self._geometry
            data = self.get_geojson()
            if not data:
                return None
            features = data.get("features", [])
            geometries = [shape(feature["geometry"]) for feature in features if feature.get("geometry")]
            self._geometry = unary_union(geometries) if geometries else None
            return self._geometry

    def clear_cache(self) -> None:
        with self._lock:
            self._geometry = None
            self._vector.clear_cache()


coastline_service = CoastlineService()

__all__ = ["CoastlineService", "coastline_service"]
