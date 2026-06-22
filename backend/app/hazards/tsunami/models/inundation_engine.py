from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Protocol

from shapely.geometry import GeometryCollection, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon

from app.hazards.tsunami.models.wave_engine import KM_PER_DEGREE, destination_point, initial_bearing_deg
from app.shared.gis.coastline_service import coastline_service
from app.shared.gis.terrain_service import terrain_service


class TerrainSampler(Protocol):
    def is_available(self) -> bool:
        ...

    def sample_elevations_m(self, coords: list[tuple[float, float]]) -> list[float | None]:
        ...


class CoastlineProvider(Protocol):
    def is_available(self) -> bool:
        ...

    def get_geometry(self):
        ...


@dataclass(frozen=True)
class InundationInput:
    wave_height_m: float
    source_latitude: float | None = None
    source_longitude: float | None = None
    max_coast_points: int = 50
    coast_spacing_km: float = 25.0
    transect_length_km: float = 10.0
    transect_spacing_m: float = 250.0
    beach_slope: float | None = None


@dataclass(frozen=True)
class InundationResult:
    is_available: bool
    runup_height_m: float | None
    max_flood_depth_m: float | None
    inundation_distance_m: float | None
    flood_extent_polygon: dict[str, Any] | None
    flood_depth_points: dict[str, Any]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_available": self.is_available,
            "runup_height_m": self.runup_height_m,
            "max_flood_depth_m": self.max_flood_depth_m,
            "inundation_distance_m": self.inundation_distance_m,
            "flood_extent_polygon": self.flood_extent_polygon,
            "flood_depth_points": self.flood_depth_points,
            "metadata": self.metadata,
        }


class InundationEngine:
    def __init__(
        self,
        *,
        terrain: TerrainSampler = terrain_service,
        coastline: CoastlineProvider = coastline_service,
    ) -> None:
        self.terrain = terrain
        self.coastline = coastline

    def model(self, request: InundationInput) -> InundationResult:
        try:
            _validate_request(request)
        except ValueError as exc:
            return self._unavailable(str(exc))

        if not self.terrain.is_available():
            return self._unavailable("DEM terrain raster is not configured or unavailable")
        if not self.coastline.is_available():
            return self._unavailable("Coastline vector data is not configured or unavailable")

        coastline_geometry = self.coastline.get_geometry()
        if coastline_geometry is None:
            return self._unavailable("Coastline geometry could not be loaded")

        coast_points = self._sample_coastline_points(coastline_geometry, request)
        flooded_features = []
        flooded_coords: list[tuple[float, float]] = []
        max_depth = 0.0
        max_distance = 0.0
        slopes = []

        for line, coast_lon, coast_lat in coast_points:
            bearing = _inland_bearing(line, coast_lon, coast_lat, request)
            transect = _transect_points(
                coast_lon,
                coast_lat,
                bearing,
                request.transect_length_km,
                request.transect_spacing_m,
            )
            elevations = self.terrain.sample_elevations_m(transect)
            valid_profile = [
                (index, lon, lat, elevation)
                for index, ((lon, lat), elevation) in enumerate(zip(transect, elevations, strict=False))
                if elevation is not None and math.isfinite(elevation)
            ]
            if not valid_profile:
                continue

            slope = request.beach_slope or _estimate_profile_slope(valid_profile, request.transect_spacing_m)
            if slope is None or slope <= 0:
                continue
            slopes.append(slope)
            runup = synolakis_runup_height_m(request.wave_height_m, slope)

            for index, lon, lat, elevation in valid_profile:
                flood_depth = runup - max(elevation, 0.0)
                if flood_depth <= 0:
                    continue
                distance_m = index * request.transect_spacing_m
                max_depth = max(max_depth, flood_depth)
                max_distance = max(max_distance, distance_m)
                flooded_coords.append((lon, lat))
                flooded_features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "flood_depth_m": flood_depth,
                        "elevation_m": elevation,
                        "runup_height_m": runup,
                        "distance_from_coast_m": distance_m,
                    },
                })

        if not flooded_features or not slopes:
            return self._unavailable("No flooded terrain cells were identified from DEM transects")

        average_slope = sum(slopes) / len(slopes)
        runup_height = synolakis_runup_height_m(request.wave_height_m, average_slope)
        extent = _flood_extent_feature(flooded_coords)

        return InundationResult(
            is_available=True,
            runup_height_m=runup_height,
            max_flood_depth_m=max_depth,
            inundation_distance_m=max_distance,
            flood_extent_polygon=extent,
            flood_depth_points={"type": "FeatureCollection", "features": flooded_features},
            metadata={
                "model": "synolakis_empirical_transects",
                "terrain_source": "TERRAIN_RASTER_PATH",
                "coastline_source": "COASTLINE_VECTOR_PATH",
                "is_hydrodynamic_solver": False,
                "coast_point_count": len(coast_points),
                "flooded_point_count": len(flooded_features),
                "mean_beach_slope": average_slope,
                "disclaimer": "Approximate empirical inundation estimate; not for official warning or emergency decisions.",
            },
        )

    def _sample_coastline_points(self, geometry, request: InundationInput) -> list[tuple[LineString, float, float]]:
        points: list[tuple[LineString, float, float]] = []
        spacing_degrees = max(request.coast_spacing_km / KM_PER_DEGREE, 0.01)
        for line in _iter_lines(geometry):
            if line.length <= 0:
                continue
            steps = max(int(line.length / spacing_degrees), 1)
            for index in range(steps + 1):
                point = line.interpolate(min(index * spacing_degrees, line.length))
                points.append((line, float(point.x), float(point.y)))
                if len(points) >= request.max_coast_points:
                    return points
        return points

    @staticmethod
    def _unavailable(reason: str) -> InundationResult:
        return InundationResult(
            is_available=False,
            runup_height_m=None,
            max_flood_depth_m=None,
            inundation_distance_m=None,
            flood_extent_polygon=None,
            flood_depth_points={"type": "FeatureCollection", "features": []},
            metadata={
                "model": "synolakis_empirical_transects",
                "status": "unavailable",
                "reason": reason,
            },
        )


def synolakis_runup_height_m(wave_height_m: float, beach_slope: float) -> float:
    if wave_height_m < 0:
        raise ValueError("wave_height_m must be greater than or equal to 0")
    if beach_slope <= 0:
        raise ValueError("beach_slope must be greater than 0")
    return 2.8312 * math.sqrt(beach_slope) * wave_height_m ** 1.25


def _transect_points(
    coast_lon: float,
    coast_lat: float,
    bearing_deg: float,
    transect_length_km: float,
    transect_spacing_m: float,
) -> list[tuple[float, float]]:
    steps = max(int((transect_length_km * 1000.0) / transect_spacing_m), 1)
    return [
        destination_point(coast_lon, coast_lat, bearing_deg, (index * transect_spacing_m) / 1000.0)
        for index in range(steps + 1)
    ]


def _inland_bearing(line: LineString, lon: float, lat: float, request: InundationInput) -> float:
    if request.source_latitude is not None and request.source_longitude is not None:
        bearing_from_source = initial_bearing_deg(request.source_longitude, request.source_latitude, lon, lat)
        return (bearing_from_source + 180.0) % 360.0

    distance = max(line.project(Point(lon, lat)), 0.0)
    delta = min(max(line.length * 0.01, 0.0001), 0.01)
    p1 = line.interpolate(max(distance - delta, 0.0))
    p2 = line.interpolate(min(distance + delta, line.length))
    tangent = initial_bearing_deg(float(p1.x), float(p1.y), float(p2.x), float(p2.y))
    return (tangent + 90.0) % 360.0


def _estimate_profile_slope(
    profile: list[tuple[int, float, float, float]],
    spacing_m: float,
) -> float | None:
    first_index, _, _, first_elevation = profile[0]
    candidates = [
        (index, elevation)
        for index, _, _, elevation in profile[1:]
        if index > first_index and elevation > first_elevation
    ]
    if not candidates:
        return None
    index, elevation = candidates[-1]
    distance_m = max((index - first_index) * spacing_m, 1.0)
    return max((elevation - first_elevation) / distance_m, 0.0001)


def _flood_extent_feature(coords: list[tuple[float, float]]) -> dict[str, Any] | None:
    if not coords:
        return None
    if len(coords) == 1:
        geometry = MultiPoint(coords).buffer(0.001)
    elif len(coords) == 2:
        geometry = LineString(coords).buffer(0.001)
    else:
        geometry = MultiPoint(coords).convex_hull.buffer(0.001)
    return {
        "type": "Feature",
        "geometry": geometry.__geo_interface__,
        "properties": {
            "hazard_type": "tsunami",
            "model": "synolakis_empirical_transects",
        },
    }


def _iter_lines(geometry) -> list[LineString]:
    if isinstance(geometry, LineString):
        return [geometry]
    if isinstance(geometry, MultiLineString):
        return list(geometry.geoms)
    if isinstance(geometry, Polygon):
        return [LineString(geometry.exterior.coords)]
    if isinstance(geometry, MultiPolygon):
        return [LineString(poly.exterior.coords) for poly in geometry.geoms]
    if isinstance(geometry, GeometryCollection):
        lines = []
        for item in geometry.geoms:
            lines.extend(_iter_lines(item))
        return lines
    return []


def _validate_request(request: InundationInput) -> None:
    if request.wave_height_m < 0:
        raise ValueError("wave_height_m must be greater than or equal to 0")
    if request.source_latitude is not None and not -90 <= request.source_latitude <= 90:
        raise ValueError("source_latitude must be between -90 and 90")
    if request.source_longitude is not None and not -180 <= request.source_longitude <= 180:
        raise ValueError("source_longitude must be between -180 and 180")
    if request.max_coast_points <= 0:
        raise ValueError("max_coast_points must be greater than 0")
    if request.coast_spacing_km <= 0:
        raise ValueError("coast_spacing_km must be greater than 0")
    if request.transect_length_km <= 0:
        raise ValueError("transect_length_km must be greater than 0")
    if request.transect_spacing_m <= 0:
        raise ValueError("transect_spacing_m must be greater than 0")
    if request.beach_slope is not None and request.beach_slope <= 0:
        raise ValueError("beach_slope must be greater than 0 when provided")


__all__ = [
    "InundationEngine",
    "InundationInput",
    "InundationResult",
    "synolakis_runup_height_m",
]
