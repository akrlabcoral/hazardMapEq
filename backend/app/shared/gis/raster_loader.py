"""Shared lazy raster loading helpers."""
from __future__ import annotations

from collections import namedtuple
import logging
import os
import threading
from urllib.parse import urlparse

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform

logger = logging.getLogger("hazardmap.shared.gis.raster_loader")

BoundingBox = namedtuple("BoundingBox", ["left", "bottom", "right", "top"])
WGS84_CRS = CRS.from_epsg(4326)


def is_remote_raster(path: str) -> bool:
    parsed = urlparse(path)
    return path.startswith("/vsi") or parsed.scheme in {"http", "https", "s3", "gs", "az"}


def raster_path_exists(path: str | None) -> bool:
    if not path:
        return False
    return is_remote_raster(path) or os.path.isfile(path)


class LazyRasterResource:
    """Thread-safe, process-local raster handle with lazy opening."""

    def __init__(self, name: str, path: str | None, *, default_value: float | None = None) -> None:
        self.name = name
        self.path = path or ""
        self.default_value = default_value
        self._lock = threading.RLock()
        self._dataset: rasterio.io.DatasetReader | None = None
        self._bounds: BoundingBox | None = None
        self._open_count = 0

    @property
    def open_count(self) -> int:
        return self._open_count

    def is_configured(self) -> bool:
        return bool(self.path)

    def is_available(self) -> bool:
        return raster_path_exists(self.path)

    def get_dataset(self) -> rasterio.io.DatasetReader | None:
        with self._lock:
            if self._dataset is not None:
                return self._dataset
            if not self.is_available():
                logger.debug("[Raster:%s] Not available at path=%s", self.name, self.path)
                return None
            try:
                self._dataset = rasterio.open(self.path)
                bounds = self._dataset.bounds
                self._bounds = BoundingBox(bounds.left, bounds.bottom, bounds.right, bounds.top)
                self._open_count += 1
                logger.info("[Raster:%s] Opened %s", self.name, self.path)
            except Exception as exc:
                logger.warning("[Raster:%s] Could not open %s: %s", self.name, self.path, exc)
                self._dataset = None
                self._bounds = None
            return self._dataset

    def preload(self) -> bool:
        return self.get_dataset() is not None

    def bounds(self) -> BoundingBox | None:
        self.get_dataset()
        with self._lock:
            return self._bounds

    def contains(self, lon: float, lat: float) -> bool:
        dataset = self.get_dataset()
        bounds = self.bounds()
        if dataset is None or bounds is None:
            return False
        x, y = self._to_dataset_coords(dataset, [(lon, lat)])[0]
        return bool(bounds.left <= x <= bounds.right and bounds.bottom <= y <= bounds.top)

    def sample_point(self, lon: float, lat: float) -> float | None:
        values = self.sample_points([(lon, lat)])
        if not values:
            return self.default_value
        return values[0]

    def _to_dataset_coords(
        self,
        dataset: rasterio.io.DatasetReader,
        coords: list[tuple[float, float]],
    ) -> list[tuple[float, float]]:
        if not coords or not dataset.crs or dataset.crs == WGS84_CRS:
            return coords
        xs, ys = zip(*coords, strict=False)
        tx, ty = transform(WGS84_CRS, dataset.crs, list(xs), list(ys))
        return list(zip(tx, ty, strict=False))

    def sample_points(self, coords: list[tuple[float, float]]) -> list[float | None]:
        dataset = self.get_dataset()
        if dataset is None or not coords:
            return [self.default_value for _ in coords]
        dataset_coords = self._to_dataset_coords(dataset, coords)
        bounds = dataset.bounds
        with self._lock:
            try:
                sampled = list(dataset.sample(dataset_coords))
            except Exception as exc:
                logger.warning("[Raster:%s] Sampling failed: %s", self.name, exc)
                return [self.default_value for _ in coords]

        values: list[float | None] = []
        for (x, y), item in zip(dataset_coords, sampled, strict=False):
            if not (bounds.left <= x <= bounds.right and bounds.bottom <= y <= bounds.top):
                values.append(self.default_value)
                continue
            raw = item[0] if len(item) else self.default_value
            try:
                value = float(raw)
            except (TypeError, ValueError):
                value = self.default_value
            if value is not None and dataset.nodata is not None and np.isclose(value, dataset.nodata):
                value = self.default_value
            if value is not None and not np.isfinite(value):
                value = self.default_value
            values.append(value)
        return values

    def close(self) -> None:
        with self._lock:
            if self._dataset is not None:
                try:
                    self._dataset.close()
                except Exception:
                    logger.debug("[Raster:%s] Error while closing", self.name, exc_info=True)
            self._dataset = None
            self._bounds = None


def load_all_soil_rasters() -> None:
    from app.soil.loader import load_all_soil_rasters as _load_all_soil_rasters

    _load_all_soil_rasters()


__all__ = [
    "BoundingBox",
    "LazyRasterResource",
    "is_remote_raster",
    "load_all_soil_rasters",
    "raster_path_exists",
]
