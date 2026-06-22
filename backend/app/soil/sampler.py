"""
app/soil/sampler.py

Vectorized batch raster sampling.
Performs ONE rasterio.sample() call per state raster, never per point.
Supports thousands of grid cells efficiently.
"""
import logging
import numpy as np
from app.soil import cache

logger = logging.getLogger("hazardmap.soil.sampler")

# Sentinel for points not covered by any raster
# 760 m/s corresponds to NEHRP Class B (Neutral / Base Rock)
NODATA_VS30 = 760.0

def sample_batch(lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    """
    Sample Vs30 values for an array of (lon, lat) coordinates.

    Strategy:
      1. Build a bounds registry from the cache.
      2. Group point indices by which state raster covers them.
      3. For each state group, issue a single rasterio.sample() call.
      4. Reassemble results in original order.

    Returns:
      np.ndarray of float32 — Vs30 values in m/s.
    """
    lons = np.asarray(lons, dtype=np.float64)
    lats = np.asarray(lats, dtype=np.float64)
    n = len(lons)
    result = np.full(n, NODATA_VS30, dtype=np.float32)

    bounds_registry = cache.get_bounds_registry()

    if not bounds_registry:
        # No rasters loaded — return all nodata
        return result

    # Group point indices by state raster
    state_groups: dict[str, list[int]] = {}
    for idx in range(n):
        lon, lat = lons[idx], lats[idx]
        matched = _find_state(lon, lat, bounds_registry)
        if matched:
            state_groups.setdefault(matched, []).append(idx)

    # Sample each state group in a single rasterio call
    for state_name, indices in state_groups.items():
        try:
            coords = [(float(lons[i]), float(lats[i])) for i in indices]
            sampled = cache.sample_points(state_name, coords)
            for j, idx in enumerate(indices):
                raw_item = sampled[j]
                raw = raw_item[0] if hasattr(raw_item, "__getitem__") and not isinstance(raw_item, (float, int)) else raw_item
                # Negative values or <= 0 often indicate nodata in rasters
                if raw is not None and raw > 0:
                    result[idx] = np.float32(raw)
        except Exception as e:
            logger.warning("[SoilSampler] Sampling failed for '%s': %s", state_name, e)

    return result


def _find_state(lon: float, lat: float, bounds_registry: dict) -> str | None:
    """
    Return the name of the first state raster whose bounding box
    contains the given (lon, lat) point.  Returns None if no match.
    """
    for state_name, bb in bounds_registry.items():
        if bb.left <= lon <= bb.right and bb.bottom <= lat <= bb.top:
            return state_name
    return None
