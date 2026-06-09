import logging
from shapely.geometry import Point, box
import geopandas as gpd
import os

logger = logging.getLogger("hazardmap.gis.boundary")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDIA_GEOJSON_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'data', 'india', 'india_boundary.geojson'))

BUFFER_DEG = 9.0


class BoundaryProvider:
    def __init__(self, path: str = INDIA_GEOJSON_PATH, buffer_deg: float = BUFFER_DEG) -> None:
        self.path = path
        self.buffer_deg = buffer_deg
        self.geometry = self._load_geometry()
        self.buffered_geometry = self.geometry.buffer(buffer_deg)

    def _load_geometry(self):
        try:
            india_gdf = gpd.read_file(self.path)
            return india_gdf.geometry.iloc[0]
        except Exception as exc:
            logger.warning(
                "Failed to load India boundary GeoJSON; falling back to bounding box. Error: %s",
                exc,
            )
            return box(68.7, 8.4, 97.25, 37.6)

    def contains_supported_epicenter(self, lat: float, lon: float) -> bool:
        return self.buffered_geometry.contains(Point(lon, lat))


_provider = BoundaryProvider()
_india_geom = _provider.geometry
BUFFERED_INDIA = _provider.buffered_geometry


def get_india_geom():
    """Return the raw (unbuffered) India geometry. Public accessor for internal use."""
    return _india_geom


def is_epicenter_valid(lat: float, lon: float) -> bool:
    """
    Validates if the epicenter is inside India or within ~1000 km of the boundary
    (9-degree buffer ≈ 1000 km at the equator).
    Uses the real GeoJSON polygon of India's borders.
    """
    return _provider.contains_supported_epicenter(lat, lon)
