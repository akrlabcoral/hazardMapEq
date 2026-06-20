from __future__ import annotations

import json
import logging
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from shapely.geometry import MultiLineString, Point, shape
from shapely.ops import unary_union

from app.ingest.normalizer import EarthquakeEvent

logger = logging.getLogger("hazardmap.tsunami")

MIN_TSUNAMI_MAGNITUDE = 6.8
MAX_PLATE_DISTANCE_KM = 200.0
REGION_NAME = "Bay of Bengal"

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
BAY_POLYGON_PATH = DATA_DIR / "tsunami" / "bay_of_bengal.geojson"
PLATE_BOUNDARIES_PATH = DATA_DIR / "tectonicplates" / "TectonicPlateBoundaries.geojson"
EARTH_RADIUS_KM = 6371.0088


def _iter_line_strings(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == "LineString":
        yield geometry
    elif geometry.geom_type == "MultiLineString":
        yield from geometry.geoms
    elif geometry.geom_type == "GeometryCollection":
        for geom in geometry.geoms:
            yield from _iter_line_strings(geom)


@lru_cache(maxsize=1)
def _load_bay_polygon():
    with BAY_POLYGON_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    polygons = [
        shape(feature["geometry"])
        for feature in data.get("features", [])
        if feature.get("geometry")
    ]
    if not polygons:
        raise ValueError(f"No polygon features found in {BAY_POLYGON_PATH}")

    return polygons[0] if len(polygons) == 1 else unary_union(polygons)


@lru_cache(maxsize=1)
def _load_plate_lines() -> MultiLineString:
    with PLATE_BOUNDARIES_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    bay_bounds = _load_bay_polygon().bounds
    search_box = (
        bay_bounds[0] - 4.0,
        bay_bounds[1] - 4.0,
        bay_bounds[2] + 4.0,
        bay_bounds[3] + 4.0,
    )

    lines = []
    for feature in data.get("features", []):
        if not feature.get("geometry"):
            continue
        geom = shape(feature["geometry"])
        if not geom.bounds:
            continue
        minx, miny, maxx, maxy = geom.bounds
        outside = maxx < search_box[0] or minx > search_box[2] or maxy < search_box[1] or miny > search_box[3]
        if outside:
            continue
        lines.extend(_iter_line_strings(geom))

    if not lines:
        raise ValueError(f"No tectonic plate boundary lines found near {REGION_NAME}")

    return MultiLineString(lines)


def _project(lon: float, lat: float, origin_lon: float, origin_lat: float) -> tuple[float, float]:
    lon_rad = math.radians(lon)
    lat_rad = math.radians(lat)
    origin_lon_rad = math.radians(origin_lon)
    origin_lat_rad = math.radians(origin_lat)
    x = EARTH_RADIUS_KM * (lon_rad - origin_lon_rad) * math.cos(origin_lat_rad)
    y = EARTH_RADIUS_KM * (lat_rad - origin_lat_rad)
    return x, y


def _distance_point_to_segment_km(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    px, py = point
    ax, ay = start
    bx, by = end
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)

    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    nearest_x = ax + t * dx
    nearest_y = ay + t * dy
    return math.hypot(px - nearest_x, py - nearest_y)


def _nearest_plate_distance_km(lon: float, lat: float) -> float:
    lines = _load_plate_lines()
    origin = (lon, lat)
    point_xy = (0.0, 0.0)
    nearest = math.inf

    for line in lines.geoms:
        coords = list(line.coords)
        for start, end in zip(coords, coords[1:]):
            start_xy = _project(start[0], start[1], *origin)
            end_xy = _project(end[0], end[1], *origin)
            nearest = min(nearest, _distance_point_to_segment_km(point_xy, start_xy, end_xy))

    return nearest


def classify_tsunami_warning(event: EarthquakeEvent) -> dict[str, Any]:
    if event.magnitude < MIN_TSUNAMI_MAGNITUDE:
        return {"is_warning": False}

    try:
        point = Point(event.longitude, event.latitude)
        bay_polygon = _load_bay_polygon()
        if not bay_polygon.covers(point):
            return {"is_warning": False}

        distance_km = _nearest_plate_distance_km(event.longitude, event.latitude)
        if distance_km > MAX_PLATE_DISTANCE_KM:
            return {
                "is_warning": False,
                "region": REGION_NAME,
                "distance_km": round(distance_km, 1),
            }

        return {
            "is_warning": True,
            "region": REGION_NAME,
            "distance_km": round(distance_km, 1),
            "reason": (
                f"M{event.magnitude:.1f} earthquake in {REGION_NAME} within "
                f"{round(distance_km, 1)} km of a tectonic plate boundary"
            ),
        }
    except Exception as exc:
        logger.warning("Tsunami warning classifier failed closed for %s: %s", event.source_id, exc)
        return {"is_warning": False}
