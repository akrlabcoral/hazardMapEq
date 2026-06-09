"""
app/services/contour_generator.py

Generates smooth PGA contour polygons as a GeoJSON FeatureCollection.
All heavy imports are at module level (not inside the hot path).

Algorithm:
  1. Build a regular NxN meshgrid over the India bounding box.
  2. Interpolate scattered grid-cell PGA values onto the meshgrid.
  3. Apply Gaussian blur to smooth jagged interpolation edges.
  4. Restore the original peak amplitude (so high-intensity bands survive blur).
  5. Mask cells outside India's polygon.
  6. Run matplotlib contourf and convert to GeoJSON via geojsoncontour.
"""
from __future__ import annotations

import logging
import warnings
import json
from contextlib import contextmanager

import numpy as np
import matplotlib
matplotlib.use("Agg")          # non-interactive backend — safe in Docker/threads
import matplotlib.pyplot as plt
import geojsoncontour
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter
import geopandas as gpd

from app.gis.boundary import get_india_geom
from app.config import (
    PGA_LEVELS,
    PGA_COLORS,
    CONTOUR_GRID_SIZE,
    CONTOUR_BLUR_SIGMA,
    CONTOUR_FILL_OPACITY,
)

logger = logging.getLogger("hazardmap.contour")

# Pre-build GeoSeries mask once at import time for maximum speed
# (avoids rebuilding the 400x400 mask on every request)
_GRID_CACHE: dict = {}


@contextmanager
def _contour_figure():
    fig, ax = plt.subplots(figsize=(8, 8))
    try:
        yield fig, ax
    finally:
        plt.close(fig)


def generate_contour_geojson(
    grid_features: list,
    raw_pga: np.ndarray,
) -> dict:
    """
    Build and return a GeoJSON FeatureCollection of PGA contour polygons.

    Args:
        grid_features : list of GeoJSON feature dicts (centroid_lon / centroid_lat in properties)
        raw_pga       : 1-D numpy array of raw PGA values in g

    Returns:
        GeoJSON dict  — FeatureCollection with fill / fill-opacity properties
                        ready to be consumed by the frontend MapLibre layer.
    """
    try:
        x_coords = np.array([f["properties"]["centroid_lon"] for f in grid_features])
        y_coords = np.array([f["properties"]["centroid_lat"] for f in grid_features])
        z_vals   = np.asarray(raw_pga, dtype=np.float64)

        x_min, x_max = x_coords.min(), x_coords.max()
        y_min, y_max = y_coords.min(), y_coords.max()

        N = CONTOUR_GRID_SIZE
        grid_x, grid_y = np.mgrid[x_min:x_max:complex(N), y_min:y_max:complex(N)]

        # Interpolate scattered points onto regular grid
        grid_z = griddata((x_coords, y_coords), z_vals, (grid_x, grid_y), method="linear")

        # Gaussian blur: smooth jagged edges, then restore peak amplitude
        original_max = np.nanmax(grid_z)
        grid_z = np.nan_to_num(grid_z, nan=0.0)
        grid_z = gaussian_filter(grid_z, sigma=CONTOUR_BLUR_SIGMA)
        new_max = np.max(grid_z)
        if new_max > 0 and original_max > 0:
            grid_z *= original_max / new_max

        # Mask cells outside India boundary
        cache_key = _mask_cache_key(x_min, x_max, y_min, y_max, N)
        if cache_key not in _GRID_CACHE:
            pts = gpd.GeoSeries.from_xy(grid_x.flatten(), grid_y.flatten(), crs="EPSG:4326")
            _GRID_CACHE[cache_key] = pts.within(get_india_geom()).values.reshape(grid_x.shape)
        mask = _GRID_CACHE[cache_key]
        grid_z[~mask] = np.nan

        # Dynamic upper bound for the last contour band
        max_val = float(z_vals.max())
        levels  = PGA_LEVELS + [max(5.0, max_val + 1.0)]

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with _contour_figure() as (_fig, ax):
                contour = ax.contourf(
                    grid_x, grid_y, grid_z,
                    levels=levels,
                    colors=PGA_COLORS,
                    extend="max",
                )
                contour_geojson_str = geojsoncontour.contourf_to_geojson(
                    contourf=contour,
                    ndigits=4,
                    stroke_width=1,
                    fill_opacity=CONTOUR_FILL_OPACITY,
                )

        return json.loads(contour_geojson_str)

    except Exception as exc:
        logger.warning("[ContourGenerator] Failed to generate contour: %s", exc)
        return {"type": "FeatureCollection", "features": []}


def _mask_cache_key(x_min: float, x_max: float, y_min: float, y_max: float, size: int) -> tuple:
    return (round(x_min, 2), round(x_max, 2), round(y_min, 2), round(y_max, 2), size)
