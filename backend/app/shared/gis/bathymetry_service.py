"""Shared bathymetry raster service.

Bathymetry data is optional in the current repo.  Missing data fails closed by
returning ``None`` instead of raising during startup or hazard analysis.
"""
from __future__ import annotations

from app.config import settings
from app.shared.gis.raster_loader import LazyRasterResource


class BathymetryService:
    def __init__(self, path: str | None = None) -> None:
        self._raster = LazyRasterResource("bathymetry", path if path is not None else settings.bathymetry_raster_path)

    def is_available(self) -> bool:
        return self._raster.is_available()

    def preload(self) -> bool:
        return self._raster.preload()

    def sample_depth_m(self, lon: float, lat: float) -> float | None:
        value = self._raster.sample_point(lon, lat)
        if value is None:
            return None
        return abs(float(value))

    def sample_depths_m(self, coords: list[tuple[float, float]]) -> list[float | None]:
        values = self._raster.sample_points(coords)
        return [None if value is None else abs(float(value)) for value in values]

    def close(self) -> None:
        self._raster.close()


bathymetry_service = BathymetryService()

__all__ = ["BathymetryService", "bathymetry_service"]
