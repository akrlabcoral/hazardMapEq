"""
app/services/contour_generator.py

Generates smooth PGA and MMI contour polygons as GeoJSON FeatureCollections.
All heavy imports are at module level (not inside the hot path).

Algorithm:
  1. Build a regular NxN meshgrid over the India bounding box.
  2. Interpolate scattered grid-cell PGA values onto the meshgrid (ONCE).
     - Fast path: uses a pre-built Delaunay triangulation (LinearNDInterpolator)
       initialised at worker startup. Triangulation is computed only once.
     - Fallback: scipy griddata (rebuilds triangulation every call) when the
       pre-built interpolator is not available.
  3. Apply Gaussian blur to smooth jagged interpolation edges.
  4. Restore the original peak amplitude (so high-intensity bands survive blur).
  5. Mask cells outside India’s polygon.
  6. Derive the MMI grid analytically from the interpolated PGA grid (no second
     interpolation pass).
  7. Run matplotlib contourf and convert to GeoJSON via geojsoncontour.

Public API
----------
  init_contour_interpolator()         — call ONCE at worker startup (pre-builds Delaunay tri)
  generate_contour_geojson()          — PGA damage contour (backward-compat)
  generate_intensity_contour_geojson() — MMI intensity contour (backward-compat)
  generate_both_contours()            — FAST path: single interpolation, both outputs
"""
from __future__ import annotations

import logging
import threading
import warnings
import json
from contextlib import contextmanager

import numpy as np
import matplotlib
matplotlib.use("Agg")          # non-interactive backend — safe in Docker/threads
import matplotlib.pyplot as plt
import geojsoncontour
from scipy.interpolate import LinearNDInterpolator, griddata
from scipy.ndimage import gaussian_filter
from scipy.spatial import Delaunay
import geopandas as gpd

from app.gis.boundary import get_india_geom
from app.config import (
    MMI_COLORS,
    MMI_LEVELS,
    PGA_LEVELS,
    PGA_COLORS,
    CONTOUR_GRID_SIZE,
    CONTOUR_BLUR_SIGMA,
    CONTOUR_FILL_OPACITY,
)

logger = logging.getLogger("hazardmap.contour")

# Process-level cache for the India boundary mask (NxN bool array).
# Built once per (bounding-box, N) combination — avoids an expensive
# GeoSeries.within() call on every simulation.
_GRID_CACHE: dict = {}

# Pre-built Delaunay triangulation of the simulation scatter points.
# Populated once by init_contour_interpolator() at worker startup.
# Using a pre-built triangulation means LinearNDInterpolator only needs to
# do the fast barycentric lookup step — not the expensive O(n log n)
# triangulation — on every simulation call.
_SCATTER_TRI: Delaunay | None = None
_TRI_LOCK = threading.Lock()

# Bounding box constants — used in every call; defined once here to avoid
# silent discrepancies between helper functions.
_X_MIN, _X_MAX = 68.0, 97.5
_Y_MIN, _Y_MAX = 6.5, 37.6


@contextmanager
def _contour_figure():
    fig, ax = plt.subplots(figsize=(8, 8))
    try:
        yield fig, ax
    finally:
        plt.close(fig)


def init_contour_interpolator(grid_features: list) -> None:
    """
    Pre-build the Delaunay triangulation of the simulation grid scatter points.

    This is the EXPENSIVE step (O(n log n) on ~10,000 points, ~0.5–1s).  It
    must be called exactly once, at RQ worker startup, after the grid is loaded.
    Subsequent calls are no-ops (guarded by a lock).

    After this is called, ``generate_both_contours`` uses
    ``LinearNDInterpolator`` with the cached triangulation instead of
    rebuilding it on every simulation — reducing the per-simulation
    interpolation cost by ~60–70 %.
    """
    global _SCATTER_TRI
    with _TRI_LOCK:
        if _SCATTER_TRI is not None:
            return  # already initialised
        t0 = __import__("time").perf_counter()
        x_coords = np.array([f["properties"]["centroid_lon"] for f in grid_features])
        y_coords = np.array([f["properties"]["centroid_lat"] for f in grid_features])
        _SCATTER_TRI = Delaunay(np.column_stack([x_coords, y_coords]))
        elapsed_ms = (__import__("time").perf_counter() - t0) * 1000
        logger.info(
            "[ContourGenerator] Delaunay triangulation pre-built for %d scatter points in %.0f ms.",
            len(grid_features),
            elapsed_ms,
        )


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

    Note: When you need *both* contours, prefer ``generate_both_contours()``
    which performs only one scipy interpolation pass instead of two.
    """
    return _generate_contour_geojson(
        grid_features=grid_features,
        values=raw_pga,
        levels=PGA_LEVELS,
        colors=PGA_COLORS,
        upper_floor=5.0,
        upper_padding=1.0,
        fill_opacity=CONTOUR_FILL_OPACITY,
    )


def generate_intensity_contour_geojson(
    grid_features: list,
    mmi_values: np.ndarray,
) -> dict:
    """
    Build smooth MMI contour polygons from numeric intensity values.

    The returned GeoJSON uses the same fill/fill-opacity properties as the PGA
    contour output, so the frontend can render it with the same MapLibre paint
    shape while displaying Roman labels in the legend and inspection panel.
    """
    geojson = _generate_contour_geojson(
        grid_features=grid_features,
        values=mmi_values,
        levels=MMI_LEVELS,
        colors=MMI_COLORS,
        upper_floor=10.1,
        upper_padding=0.1,
        fill_opacity=0.84,
    )
    labels_by_color = {
        "#bfccff": "III",
        "#a0e6ff": "IV",
        "#80ffff": "V",
        "#7cd37c": "VI",
        "#ffec7d": "VII",
        "#ffb834": "VIII",
        "#ff6666": "IX",
        "#cc0000": "X+",
    }
    for feature in geojson.get("features", []):
        props = feature.setdefault("properties", {})
        fill = str(props.get("fill", "")).lower()
        if fill in labels_by_color:
            props["intensity"] = labels_by_color[fill]

    return geojson


# ---------------------------------------------------------------------------
# Fast path: single interpolation, both outputs
# ---------------------------------------------------------------------------

def generate_both_contours(
    grid_features: list,
    pga_final: np.ndarray,
    mmi_values: np.ndarray,
) -> tuple[dict, dict]:
    """
    Generate PGA damage contour AND MMI intensity contour in a single pass.

    The expensive scipy.interpolate.griddata Delaunay triangulation is executed
    exactly ONCE for PGA.  The MMI interpolated grid is derived analytically
    from the already-smoothed PGA grid using the pga_g_to_mmi formula, so no
    second interpolation is needed.

    Returns
    -------
    (pga_contour_geojson, intensity_contour_geojson) : tuple[dict, dict]
        Both are GeoJSON FeatureCollections ready for the frontend MapLibre layers.
    """
    try:
        pga_vals = np.asarray(pga_final, dtype=np.float64)

        N = CONTOUR_GRID_SIZE
        grid_x, grid_y = np.mgrid[_X_MIN:_X_MAX:complex(N), _Y_MIN:_Y_MAX:complex(N)]

        # ── Step 1: Single interpolation pass ───────────────────────────────
        # Fast path: use the pre-built Delaunay triangulation cached at worker
        # startup.  LinearNDInterpolator only performs the cheap barycentric
        # lookup step here — the O(n log n) triangulation was already paid for
        # once during _precompute_static_soil().
        #
        # Fallback: if init_contour_interpolator() was never called (e.g. in
        # tests or the FastAPI process), fall back to griddata which rebuilds
        # the triangulation on every call.
        if _SCATTER_TRI is not None:
            interp = LinearNDInterpolator(_SCATTER_TRI, pga_vals, fill_value=np.nan)
            grid_pga = interp(grid_x, grid_y)
        else:
            x_coords = np.array([f["properties"]["centroid_lon"] for f in grid_features])
            y_coords = np.array([f["properties"]["centroid_lat"] for f in grid_features])
            grid_pga = griddata(
                (x_coords, y_coords), pga_vals, (grid_x, grid_y), method="linear"
            )

        # ── Step 2: Gaussian blur + peak-amplitude restore (PGA) ────────────
        original_max_pga = np.nanmax(grid_pga)
        grid_pga = np.nan_to_num(grid_pga, nan=0.0)
        grid_pga = gaussian_filter(grid_pga, sigma=CONTOUR_BLUR_SIGMA)
        new_max_pga = np.max(grid_pga)
        if new_max_pga > 0 and original_max_pga > 0:
            grid_pga *= original_max_pga / new_max_pga

        # ── Step 3: Derive MMI analytically — no second interpolation ───────
        # pga_g_to_mmi formula: 3.66 * log10(pga_cm_s2) - 1.66
        # Applied element-wise to the already-smoothed PGA meshgrid.
        pga_cm_s2 = np.maximum(grid_pga * 980.665, 1e-9)
        grid_mmi = 3.66 * np.log10(pga_cm_s2) - 1.66
        grid_mmi = np.clip(grid_mmi, 1.0, 10.0)

        # ── Step 4: India boundary mask (cached per grid size) ───────────────
        cache_key = _mask_cache_key(_X_MIN, _X_MAX, _Y_MIN, _Y_MAX, N)
        if cache_key not in _GRID_CACHE:
            pts = gpd.GeoSeries.from_xy(
                grid_x.flatten(), grid_y.flatten(), crs="EPSG:4326"
            )
            _GRID_CACHE[cache_key] = pts.within(get_india_geom()).values.reshape(
                grid_x.shape
            )
        mask = _GRID_CACHE[cache_key]
        grid_pga[~mask] = np.nan
        grid_mmi[~mask] = np.nan

        # ── Step 5: Render PGA contourf ──────────────────────────────────────
        max_pga_val = float(pga_vals.max())
        pga_levels = PGA_LEVELS + [max(5.0, max_pga_val + 1.0)]

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with _contour_figure() as (_fig, ax):
                contour = ax.contourf(
                    grid_x, grid_y, grid_pga,
                    levels=pga_levels,
                    colors=PGA_COLORS,
                    extend="max",
                )
                pga_geojson_str = geojsoncontour.contourf_to_geojson(
                    contourf=contour,
                    ndigits=4,
                    stroke_width=1,
                    fill_opacity=CONTOUR_FILL_OPACITY,
                )

        # ── Step 6: Render MMI contourf ──────────────────────────────────────
        max_mmi_val = float(np.nanmax(grid_mmi)) if not np.all(np.isnan(grid_mmi)) else 10.1
        mmi_levels = MMI_LEVELS + [max(10.1, max_mmi_val + 0.1)]

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with _contour_figure() as (_fig, ax):
                contour = ax.contourf(
                    grid_x, grid_y, grid_mmi,
                    levels=mmi_levels,
                    colors=MMI_COLORS,
                    extend="max",
                )
                mmi_geojson_str = geojsoncontour.contourf_to_geojson(
                    contourf=contour,
                    ndigits=4,
                    stroke_width=1,
                    fill_opacity=0.84,
                )

        pga_geojson = json.loads(pga_geojson_str)
        mmi_geojson = json.loads(mmi_geojson_str)

        # Annotate MMI features with Roman numeral labels
        labels_by_color = {
            "#bfccff": "III",
            "#a0e6ff": "IV",
            "#80ffff": "V",
            "#7cd37c": "VI",
            "#ffec7d": "VII",
            "#ffb834": "VIII",
            "#ff6666": "IX",
            "#cc0000": "X+",
        }
        for feature in mmi_geojson.get("features", []):
            props = feature.setdefault("properties", {})
            fill = str(props.get("fill", "")).lower()
            if fill in labels_by_color:
                props["intensity"] = labels_by_color[fill]

        return pga_geojson, mmi_geojson

    except Exception as exc:
        logger.warning("[ContourGenerator] generate_both_contours failed: %s", exc)
        empty = {"type": "FeatureCollection", "features": []}
        return empty, empty


def _generate_contour_geojson(
    grid_features: list,
    values: np.ndarray,
    levels: list[float],
    colors: list[str],
    upper_floor: float,
    upper_padding: float,
    fill_opacity: float,
) -> dict:
    try:
        x_coords = np.array([f["properties"]["centroid_lon"] for f in grid_features])
        y_coords = np.array([f["properties"]["centroid_lat"] for f in grid_features])
        z_vals = np.asarray(values, dtype=np.float64)

        x_min, x_max = 68.0, 97.5
        y_min, y_max = 6.5, 37.6

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
        contour_levels = levels + [max(upper_floor, max_val + upper_padding)]

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with _contour_figure() as (_fig, ax):
                contour = ax.contourf(
                    grid_x, grid_y, grid_z,
                    levels=contour_levels,
                    colors=colors,
                    extend="max",
                )
                contour_geojson_str = geojsoncontour.contourf_to_geojson(
                    contourf=contour,
                    ndigits=4,
                    stroke_width=1,
                    fill_opacity=fill_opacity,
                )

        return json.loads(contour_geojson_str)

    except Exception as exc:
        logger.warning("[ContourGenerator] Failed to generate contour: %s", exc)
        return {"type": "FeatureCollection", "features": []}


def _mask_cache_key(x_min: float, x_max: float, y_min: float, y_max: float, size: int) -> tuple:
    return (round(x_min, 2), round(x_max, 2), round(y_min, 2), round(y_max, 2), size)
