import logging
from shapely.geometry import Point, box
import geopandas as gpd
import os

logger = logging.getLogger("hazardmap.gis.boundary")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDIA_GEOJSON_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'data', 'india', 'india_boundary.geojson'))

# Load the actual India boundary and buffer it for validation
try:
    _india_gdf = gpd.read_file(INDIA_GEOJSON_PATH)
    # The dissolved geometry is typically in the first row
    _india_geom = _india_gdf.geometry.iloc[0]
except Exception as e:
    logger.warning(
        "Failed to load India boundary GeoJSON — falling back to bounding box. Error: %s", e
    )
    _india_geom = box(68.7, 8.4, 97.25, 37.6)

# Pre-compute the buffered boundary (1 degree ≈ 111 km at the equator; 9 degrees ≈ 1000 km)
BUFFER_DEG = 9.0
BUFFERED_INDIA = _india_geom.buffer(BUFFER_DEG)


def get_india_geom():
    """Return the raw (unbuffered) India geometry. Public accessor for internal use."""
    return _india_geom


def is_epicenter_valid(lat: float, lon: float) -> bool:
    """
    Validates if the epicenter is inside India or within ~1000 km of the boundary
    (9-degree buffer ≈ 1000 km at the equator).
    Uses the real GeoJSON polygon of India's borders.
    """
    epicenter = Point(lon, lat)
    return BUFFERED_INDIA.contains(epicenter)
