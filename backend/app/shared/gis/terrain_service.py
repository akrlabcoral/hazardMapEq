"""Shared terrain/DEM raster service.

Terrain data is optional until a DEM is configured.
"""
from __future__ import annotations

from app.config import settings
from app.shared.gis.raster_loader import LazyRasterResource


class TerrainService:
    def __init__(self, path: str | None = None) -> None:
        self._raster = LazyRasterResource("terrain", path if path is not None else settings.terrain_raster_path)

    def is_available(self) -> bool:
        return self._raster.is_available()

    def preload(self) -> bool:
        return self._raster.preload()

    def sample_elevation_m(self, lon: float, lat: float) -> float | None:
        value = self._raster.sample_point(lon, lat)
        return None if value is None else float(value)

    def sample_elevations_m(self, coords: list[tuple[float, float]]) -> list[float | None]:
        values = self._raster.sample_points(coords)
        return [None if value is None else float(value) for value in values]

    def close(self) -> None:
        self._raster.close()


terrain_service = TerrainService()

__all__ = ["TerrainService", "terrain_service"]
