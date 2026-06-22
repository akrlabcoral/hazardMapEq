"""Shared administrative boundary service."""
from __future__ import annotations

import logging
from pathlib import Path
import threading
from typing import Any

from shapely.geometry import Point, box, shape
from shapely.ops import unary_union

from app.config import settings
from app.shared.gis.vector_loader import LazyGeoJSONResource

logger = logging.getLogger("hazardmap.shared.gis.boundary_service")

BUFFER_DEG = 1.8
FALLBACK_INDIA_BOUNDS = (68.7, 8.4, 97.25, 37.6)


def _repo_data_boundary_path() -> Path:
    return Path(__file__).resolve().parents[3] / "data" / "india" / "india_boundary.geojson"


class BoundaryService:
    def __init__(self, path: str | None = None, *, buffer_deg: float = BUFFER_DEG) -> None:
        configured = Path(path if path is not None else settings.india_boundary_path)
        if not configured.is_file():
            local = _repo_data_boundary_path()
            configured = local if local.is_file() else configured
        self._vector = LazyGeoJSONResource("india-boundary", configured)
        self.buffer_deg = buffer_deg
        self._lock = threading.RLock()
        self._geometry = None
        self._buffered_geometry = None

    def is_available(self) -> bool:
        return self._vector.is_available()

    def get_geojson(self) -> dict[str, Any] | None:
        return self._vector.get_data()

    def get_geometry(self):
        with self._lock:
            if self._geometry is not None:
                return self._geometry
            data = self.get_geojson()
            if data:
                try:
                    features = data.get("features", [])
                    geometries = [shape(feature["geometry"]) for feature in features if feature.get("geometry")]
                    if geometries:
                        self._geometry = unary_union(geometries)
                        return self._geometry
                except Exception as exc:
                    logger.warning("Failed to parse India boundary; using fallback bounds. Error: %s", exc)
            self._geometry = box(*FALLBACK_INDIA_BOUNDS)
            return self._geometry

    def get_buffered_geometry(self):
        with self._lock:
            if self._buffered_geometry is None:
                self._buffered_geometry = self.get_geometry().buffer(self.buffer_deg)
            return self._buffered_geometry

    def contains_supported_epicenter(self, lat: float, lon: float) -> bool:
        return self.get_buffered_geometry().contains(Point(lon, lat))

    def clear_cache(self) -> None:
        with self._lock:
            self._geometry = None
            self._buffered_geometry = None
            self._vector.clear_cache()


boundary_service = BoundaryService()


def get_india_geom():
    return boundary_service.get_geometry()


def is_epicenter_valid(lat: float, lon: float) -> bool:
    return boundary_service.contains_supported_epicenter(lat, lon)


__all__ = ["BoundaryService", "boundary_service", "get_india_geom", "is_epicenter_valid"]
