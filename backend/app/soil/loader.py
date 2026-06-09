"""
app/soil/loader.py

Discovers the national Vs30 GeoTIFF file at startup and registers it
with the cache. Must be called once from app/main.py before any
simulation request is served.
"""
import logging
import os
from app.config import settings
from app.soil import cache

logger = logging.getLogger("hazardmap.soil.loader")

VS30_RASTER_PATH = settings.vs30_raster_path

def load_all_soil_rasters() -> None:
    """
    Load the single India Vs30 raster and register it in the cache as 'India'.
    """
    if not os.path.isfile(VS30_RASTER_PATH):
        logger.warning("[SoilLoader] Vs30 raster not found at %s", VS30_RASTER_PATH)
        logger.warning("[SoilLoader] Soil amplification will use default fallback factor 1.0 for all cells.")
        return

    try:
        cache.register("India", VS30_RASTER_PATH)
        logger.info("[SoilLoader] Successfully loaded Vs30 raster from %s.", VS30_RASTER_PATH)
    except Exception as e:
        logger.error("[SoilLoader] FAIL %s: %s", VS30_RASTER_PATH, e)

    states = cache.get_all_states()
    logger.info("[SoilLoader] States registered: %s", sorted(states))
