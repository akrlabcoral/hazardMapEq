"""
app/layers/soil/engine.py

SoilEngine — computes Vs30-based seismic amplification factors
for each grid cell using real GeoTIFF raster data.
"""
import numpy as np
from app.layers.base import BaseHazardLayer
from app.soil import sampler, site_class, amplification


class SoilEngine(BaseHazardLayer):
    """
    Samples Vs30 values from national GeoTIFF rasters,
    converts them to NEHRP site classes, and then to seismic amplification factors.
    Writes vs30 and site_class metadata back into each feature's properties.
    """

    def compute(self, grid_features, **kwargs) -> list[float]:
        """
        For each grid cell:
          1. Sample the Vs30 value from the raster.
          2. Convert Vs30 -> NEHRP site class (A-E).
          3. Convert site class -> amplification factor.
          4. Write vs30, site_class, and soil_factor into feature properties.

        Returns:
          List of raw amplification factors (float).
        """
        lons = np.array([f["properties"]["centroid_lon"] for f in grid_features], dtype=np.float64)
        lats = np.array([f["properties"]["centroid_lat"] for f in grid_features], dtype=np.float64)

        # Vectorized raster sampling
        vs30_vals    = sampler.sample_batch(lons, lats)
        site_classes = site_class.get_site_classes_batch(vs30_vals)
        soil_factors = amplification.get_amplification_batch(site_classes)

        # Write metadata into each feature's properties
        for i, feature in enumerate(grid_features):
            feature["properties"]["vs30"]        = round(float(vs30_vals[i]), 1)
            feature["properties"]["site_class"]  = site_classes[i]
            feature["properties"]["soil_factor"] = round(float(soil_factors[i]), 3)

        return soil_factors.tolist()

    def normalize(self, raw_values):
        """
        Overrides BaseHazardLayer dynamic min-max normalization.
        Vs30 amplification factors typically range [0.8, 1.7].
        We return them directly to preserve physically meaningful scaling.
        """
        if not raw_values:
            return []
            
        arr = np.array(raw_values, dtype=float)
        # Cap at 2.0 just for safety against weird data anomalies
        return np.clip(arr, 0.0, 2.0).tolist()
