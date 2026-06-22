"""Shared admin/district boundary service.

Admin boundaries are optional and loaded lazily from GeoJSON.  Tsunami, flood,
cyclone, and future coastal hazards can use this neutral service without
hardcoding city or district targets.
"""
from __future__ import annotations

import threading
from typing import Any

from shapely.geometry import Point, shape

from app.config import settings
from app.shared.gis.vector_loader import LazyGeoJSONResource


class AdminBoundaryService:
    def __init__(self, path: str | None = None) -> None:
        self._vector = LazyGeoJSONResource(
            "admin_boundaries",
            path if path is not None else settings.admin_boundaries_vector_path,
        )
        self._lock = threading.RLock()
        self._features: list[tuple[Any, dict[str, Any]]] | None = None

    def is_available(self) -> bool:
        return self._vector.is_available()

    def get_geojson(self) -> dict[str, Any] | None:
        return self._vector.get_data()

    def get_features(self) -> list[tuple[Any, dict[str, Any]]]:
        with self._lock:
            if self._features is not None:
                return self._features
            data = self.get_geojson()
            if not data:
                self._features = []
                return self._features
            parsed = []
            for feature in data.get("features", []):
                geometry = feature.get("geometry")
                if not geometry:
                    continue
                parsed.append((shape(geometry), dict(feature.get("properties") or {})))
            self._features = parsed
            return parsed

    def find_metadata(self, lon: float, lat: float) -> dict[str, Any]:
        point = Point(lon, lat)
        features = self.get_features()
        if not features:
            return {}

        nearest: tuple[float, dict[str, Any]] | None = None
        for geometry, properties in features:
            if geometry.contains(point) or geometry.touches(point):
                return properties
            distance = geometry.distance(point)
            if nearest is None or distance < nearest[0]:
                nearest = (distance, properties)
        return dict(nearest[1]) if nearest else {}

    def clear_cache(self) -> None:
        with self._lock:
            self._features = None
            self._vector.clear_cache()


admin_boundary_service = AdminBoundaryService()

__all__ = ["AdminBoundaryService", "admin_boundary_service"]
