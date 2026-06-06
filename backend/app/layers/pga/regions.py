"""
app/layers/pga/regions.py

Tectonic region detection using the global plate boundaries GeoJSON.
"""
import json
import logging
import os
from enum import Enum

from shapely.geometry import shape, Point, box, MultiLineString

logger = logging.getLogger("hazardmap.pga.regions")

class TectonicRegion(str, Enum):
    HIMALAYA = "HIMALAYA"
    NORTHEAST = "NORTHEAST"
    PENINSULAR = "PENINSULAR"


_ACTIVE_MARGIN_POLY = None

def _initialize_regions():
    """
    Loads the tectonic plate boundaries GeoJSON, extracts lines near India,
    and creates a 2.0 degree buffered polygon representing the active margins.
    """
    global _ACTIVE_MARGIN_POLY
    
    geojson_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "data", "tectonicplates", "TectonicPlateBoundaries.geojson"
    )
    # Resolve to absolute path
    geojson_path = os.path.abspath(geojson_path)
    
    if not os.path.exists(geojson_path):
        logger.warning(f"Plate boundaries file not found at {geojson_path}. All regions will default to PENINSULAR.")
        return

    try:
        with open(geojson_path, "r") as f:
            data = json.load(f)

        # Bounding box roughly covering the Indian subcontinent and its plate margins
        # (lon 68.0 to 98.0, lat 8.0 to 38.0)
        india_box = box(68.0, 8.0, 98.0, 38.0)
        
        lines = []
        for feat in data.get("features", []):
            geom = shape(feat["geometry"])
            if geom.intersects(india_box):
                lines.append(geom.intersection(india_box))

        if not lines:
            logger.warning("No plate boundaries found near India in the GeoJSON.")
            return

        # Combine lines into a single MultiLineString
        line_geoms = []
        for boundary in lines:
            if boundary.geom_type == 'LineString':
                line_geoms.append(boundary)
            elif boundary.geom_type == 'MultiLineString':
                line_geoms.extend(boundary.geoms)
                
        active_margin = MultiLineString(line_geoms)
        
        # Buffer by 4.0 degrees (approx 440 km) to encompass the entire active collision zone
        # This ensures wide deformation zones (like Ladakh/Kashmir) are correctly classified
        _ACTIVE_MARGIN_POLY = active_margin.buffer(4.0)
        logger.info("Successfully built active margin polygon from plate boundaries GeoJSON.")
        
    except Exception as exc:
        logger.error(f"Failed to initialize tectonic regions: {exc}")


# Initialize exactly once on module import
_initialize_regions()


def get_tectonic_region(lat: float, lon: float) -> TectonicRegion:
    """
    Returns the tectonic region for a given epicenter.
    """
    if _ACTIVE_MARGIN_POLY is None:
        return TectonicRegion.PENINSULAR
        
    pt = Point(lon, lat)
    
    if _ACTIVE_MARGIN_POLY.contains(pt):
        # Longitude 89.0 accurately separates Sikkim (Himalaya) from Assam/Northeast
        if lon > 89.0:
            return TectonicRegion.NORTHEAST
        else:
            # Exclude the Peninsular shield elements (e.g. Jharkhand, southern UP, MP)
            # that might fall within the 4.0 degree buffer of the active margin.
            # The Himalayan thrust influence effectively stops north of ~25.0 N
            if lat < 25.0:
                return TectonicRegion.PENINSULAR
            return TectonicRegion.HIMALAYA
            
    return TectonicRegion.PENINSULAR
