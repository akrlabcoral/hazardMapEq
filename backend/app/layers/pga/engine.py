"""
app/layers/pga/engine.py

Vectorized PGA (Peak Ground Acceleration) engine.
Uses numpy for all grid-level computations — no Python for-loops.

Expected speedup vs. the previous per-cell Python loop: ~40–80x.
"""
import numpy as np
from app.layers.base import BaseHazardLayer
from app.config import MAX_EXPECTED_PGA


class PGAEngine(BaseHazardLayer):
    """
    Computes Peak Ground Acceleration using a provided GMPE model.
    Accounts for Magnitude, Hypocentral Distance, and Depth.
    Does NOT include soil or lithology amplification.
    """

    def compute(
        self,
        grid_features: list,
        magnitude: float,
        epicenter_lat: float,
        epicenter_lon: float,
        depth: float,
        gmpe: 'BaseGMPE',
    ) -> np.ndarray:
        """
        Returns a 1-D numpy array of raw PGA values (in g) for every grid cell.
        """

        # Extract coordinates as numpy arrays in one pass
        lons = np.array([f["properties"]["centroid_lon"] for f in grid_features], dtype=np.float64)
        lats = np.array([f["properties"]["centroid_lat"] for f in grid_features], dtype=np.float64)

        # Vectorized haversine distance (km)
        surface_dist = self._haversine_vec(epicenter_lon, epicenter_lat, lons, lats)

        # Hypocentral distance (3-D, km) — clamp to >= 1.0 to prevent log(0)
        R = np.maximum(np.sqrt(surface_dist ** 2 + depth ** 2), 1.0)

        # Delegate the actual PGA calculation to the selected GMPE model
        return gmpe.calculate_pga(magnitude, R, depth)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _haversine_vec(
        self,
        lon1: float,
        lat1: float,
        lons2: np.ndarray,
        lats2: np.ndarray,
    ) -> np.ndarray:
        """Vectorized haversine — returns distances in km."""
        R_EARTH = 6371.0
        dlon = np.radians(lons2 - lon1)
        dlat = np.radians(lats2 - lat1)
        a = (
            np.sin(dlat / 2) ** 2
            + np.cos(np.radians(lat1)) * np.cos(np.radians(lats2)) * np.sin(dlon / 2) ** 2
        )
        return R_EARTH * 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))

    def normalize(self, raw_values: np.ndarray) -> np.ndarray:
        """
        Fixed-scale normalization: PGA of MAX_EXPECTED_PGA (1.0 g) → score 1.0.
        Accepts and returns numpy arrays.
        """
        arr = np.asarray(raw_values, dtype=np.float64)
        return np.clip(arr / MAX_EXPECTED_PGA, 0.0, 1.0)
