"""Shared population raster service."""
from __future__ import annotations

from app.config import settings
from app.shared.gis.raster_loader import LazyRasterResource


class PopulationService:
    def __init__(self, path: str | None = None) -> None:
        self._raster = LazyRasterResource(
            "population",
            path if path is not None else settings.population_raster_path,
            default_value=0.0,
        )

    def is_available(self) -> bool:
        return self._raster.is_available()

    def preload(self) -> bool:
        return self._raster.preload()

    def sample_population(self, lon: float, lat: float) -> int:
        value = self._raster.sample_point(lon, lat)
        return max(int(value or 0), 0)

    def sample_population_batch(self, coords: list[tuple[float, float]]) -> list[int]:
        return [max(int(value or 0), 0) for value in self._raster.sample_points(coords)]

    def close(self) -> None:
        self._raster.close()


population_service = PopulationService()

__all__ = ["PopulationService", "population_service"]
