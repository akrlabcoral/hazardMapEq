"""
app/soil/loader.py

Discovers the national Vs30 GeoTIFF file at startup and registers it
with the cache. Must be called once from app/main.py before any
simulation request is served.
"""
import os
from app.soil import cache

VS30_RASTER_PATH = os.environ.get(
    "VS30_RASTER_PATH",
    "/app/data/soil/india_vs30.tif",   # default: Docker container path
)

def load_all_soil_rasters() -> None:
    """
    Load the single India Vs30 raster and register it in the cache as 'India'.
    """
    if not os.path.isfile(VS30_RASTER_PATH):
        print(f"[SoilLoader] WARNING: Vs30 raster not found at {VS30_RASTER_PATH}")
        print("[SoilLoader] Soil amplification will use default fallback factor 1.0 for all cells.")
        return

    try:
        cache.register("India", VS30_RASTER_PATH)
        print(f"[SoilLoader] Successfully loaded Vs30 raster from {VS30_RASTER_PATH}.")
    except Exception as e:
        print(f"[SoilLoader] FAIL {os.path.basename(VS30_RASTER_PATH)}: {e}")

    states = cache.get_all_states()
    print(f"[SoilLoader] States registered: {sorted(states)}")
