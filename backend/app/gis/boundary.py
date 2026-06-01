from shapely.geometry import Point, box
import geopandas as gpd

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDIA_GEOJSON_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'data', 'india', 'india_boundary.geojson'))

# Load the actual India boundary and buffer it for validation
try:
    _india_gdf = gpd.read_file(INDIA_GEOJSON_PATH)
    # The dissolved geometry is typically in the first row
    _india_geom = _india_gdf.geometry.iloc[0]
except Exception as e:
    print(f"Warning: Failed to load India boundary GeoJSON. Falling back to bounding box. Error: {e}")
    _india_geom = box(68.7, 8.4, 97.25, 37.6)

# Pre-compute the buffered boundary (1 degree is roughly 111km at the equator)
BUFFER_DEG = 9.0 
BUFFERED_INDIA = _india_geom.buffer(BUFFER_DEG)

def is_epicenter_valid(lat: float, lon: float) -> bool:
    """
    Validates if the epicenter is inside India or within 100km of the boundary.
    Uses the real GeoJSON polygon of India's borders.
    """
    epicenter = Point(lon, lat)
    return BUFFERED_INDIA.contains(epicenter)

