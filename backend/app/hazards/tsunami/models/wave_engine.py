from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Protocol

from shapely.geometry import GeometryCollection, LineString, MultiLineString, MultiPolygon, Polygon

from app.hazards.tsunami.models.okada_model import EARTH_RADIUS_KM, OkadaSourceModel, SourceModelInput
from app.shared.gis.admin_boundary_service import admin_boundary_service
from app.shared.gis.bathymetry_service import bathymetry_service
from app.shared.gis.coastline_service import coastline_service

GRAVITY_MPS2 = 9.81
KM_PER_DEGREE = 111.32
DEFAULT_PATH_SAMPLES = 24


class BathymetrySampler(Protocol):
    def is_available(self) -> bool:
        ...

    def sample_depths_m(self, coords: list[tuple[float, float]]) -> list[float | None]:
        ...


class CoastlineProvider(Protocol):
    def is_available(self) -> bool:
        ...

    def get_geometry(self):
        ...


class AdminMetadataProvider(Protocol):
    def is_available(self) -> bool:
        ...

    def find_metadata(self, lon: float, lat: float) -> dict[str, Any]:
        ...


@dataclass(frozen=True)
class WavePropagationInput:
    source_latitude: float
    source_longitude: float
    offshore_wave_height_m: float | None = None
    magnitude: float | None = None
    max_targets: int = 100
    target_spacing_km: float = 50.0
    coastal_depth_m: float = 10.0
    amplification_factor: float = 1.5


@dataclass(frozen=True)
class WaveTargetResult:
    target: dict[str, Any]
    admin_metadata: dict[str, Any]
    distance_km: float
    eta_minutes: float
    wave_speed_mps: float
    wave_speed_kmh: float
    coastal_wave_height_m: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "target": self.target,
            "admin_metadata": self.admin_metadata,
            "distance_km": self.distance_km,
            "eta_minutes": self.eta_minutes,
            "wave_speed_mps": self.wave_speed_mps,
            "wave_speed_kmh": self.wave_speed_kmh,
            "coastal_wave_height_m": self.coastal_wave_height_m,
        }


@dataclass(frozen=True)
class WavePropagationResult:
    is_available: bool
    source: dict[str, Any]
    targets: list[WaveTargetResult]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_available": self.is_available,
            "source": self.source,
            "targets": [target.to_dict() for target in self.targets],
            "metadata": self.metadata,
        }


class WavePropagationEngine:
    def __init__(
        self,
        *,
        bathymetry: BathymetrySampler = bathymetry_service,
        coastline: CoastlineProvider = coastline_service,
        admin_boundaries: AdminMetadataProvider = admin_boundary_service,
        source_model: OkadaSourceModel | None = None,
    ) -> None:
        self.bathymetry = bathymetry
        self.coastline = coastline
        self.admin_boundaries = admin_boundaries
        self.source_model = source_model or OkadaSourceModel()

    def propagate(self, request: WavePropagationInput) -> WavePropagationResult:
        try:
            _validate_request(request)
        except ValueError as exc:
            return self._unavailable(request, str(exc))

        if not self.bathymetry.is_available():
            return self._unavailable(request, "Bathymetry raster is not configured or unavailable")
        if not self.coastline.is_available():
            return self._unavailable(request, "Coastline vector data is not configured or unavailable")
        if not self.admin_boundaries.is_available():
            return self._unavailable(request, "Admin boundary vector data is not configured or unavailable")

        coastline_geometry = self.coastline.get_geometry()
        if coastline_geometry is None:
            return self._unavailable(request, "Coastline geometry could not be loaded")

        offshore_height = self._resolve_offshore_height(request)
        if offshore_height is None:
            return self._unavailable(request, "Provide offshore_wave_height_m or magnitude to estimate source height")

        targets = self._generate_targets(coastline_geometry, request)
        results = [
            result
            for target_lon, target_lat in targets
            if (result := self._propagate_to_target(request, target_lon, target_lat, offshore_height)) is not None
        ]
        if not results:
            return self._unavailable(request, "No coastal targets could be evaluated with available bathymetry")

        return WavePropagationResult(
            is_available=True,
            source=self._source_payload(request, offshore_height),
            targets=results,
            metadata={
                "model": "bathymetry_path_sampling",
                "bathymetry_source": "GEBCO via BATHYMETRY_RASTER_PATH",
                "coastline_source": "COASTLINE_VECTOR_PATH",
                "admin_boundaries_source": "ADMIN_BOUNDARIES_VECTOR_PATH",
                "height_model": "Green's Law shoaling approximation",
                "is_numerical_wave_solver": False,
                "target_count": len(results),
            },
        )

    def _propagate_to_target(
        self,
        request: WavePropagationInput,
        target_lon: float,
        target_lat: float,
        offshore_height_m: float,
    ) -> WaveTargetResult | None:
        distance_km = haversine_km(
            request.source_longitude,
            request.source_latitude,
            target_lon,
            target_lat,
        )
        if distance_km <= 0:
            return None

        coords = path_points(
            request.source_longitude,
            request.source_latitude,
            target_lon,
            target_lat,
            DEFAULT_PATH_SAMPLES,
        )
        depths = [depth for depth in self.bathymetry.sample_depths_m(coords) if depth is not None and depth > 0]
        if not depths:
            return None

        speeds = [wave_speed_mps(depth) for depth in depths]
        average_speed_mps = sum(speeds) / len(speeds)
        eta_minutes = (distance_km * 1000.0) / average_speed_mps / 60.0
        offshore_depth = max(depths)
        coastal_height = green_law_height_m(
            offshore_height_m=offshore_height_m,
            offshore_depth_m=offshore_depth,
            coastal_depth_m=request.coastal_depth_m,
            amplification_factor=request.amplification_factor,
        )

        return WaveTargetResult(
            target={
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [target_lon, target_lat]},
                "properties": {"hazard_type": "tsunami", "target_type": "coastline"},
            },
            admin_metadata=self.admin_boundaries.find_metadata(target_lon, target_lat),
            distance_km=distance_km,
            eta_minutes=eta_minutes,
            wave_speed_mps=average_speed_mps,
            wave_speed_kmh=average_speed_mps * 3.6,
            coastal_wave_height_m=coastal_height,
        )

    def _generate_targets(self, geometry, request: WavePropagationInput) -> list[tuple[float, float]]:
        targets: list[tuple[float, float]] = []
        spacing_degrees = max(request.target_spacing_km / KM_PER_DEGREE, 0.01)
        for line in _iter_lines(geometry):
            if line.length <= 0:
                continue
            steps = max(int(line.length / spacing_degrees), 1)
            for index in range(steps + 1):
                point = line.interpolate(min(index * spacing_degrees, line.length))
                targets.append((float(point.x), float(point.y)))
                if len(targets) >= request.max_targets:
                    return targets
        return targets

    def _resolve_offshore_height(self, request: WavePropagationInput) -> float | None:
        if request.offshore_wave_height_m is not None:
            return request.offshore_wave_height_m
        if request.magnitude is None:
            return None
        source_result = self.source_model.model(
            SourceModelInput(
                magnitude=request.magnitude,
                latitude=request.source_latitude,
                longitude=request.source_longitude,
            )
        )
        values = [
            feature["properties"]["vertical_deformation_m"]
            for feature in source_result.vertical_deformation.get("features", [])
            if feature.get("properties")
        ]
        positives = [value for value in values if value > 0]
        if positives:
            return max(positives)
        return max((abs(value) for value in values), default=None)

    def _unavailable(self, request: WavePropagationInput, reason: str) -> WavePropagationResult:
        return WavePropagationResult(
            is_available=False,
            source=self._source_payload(request, request.offshore_wave_height_m),
            targets=[],
            metadata={
                "model": "bathymetry_path_sampling",
                "status": "unavailable",
                "reason": reason,
            },
        )

    @staticmethod
    def _source_payload(request: WavePropagationInput, offshore_wave_height_m: float | None) -> dict[str, Any]:
        return {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [request.source_longitude, request.source_latitude]},
            "properties": {
                "hazard_type": "tsunami",
                "offshore_wave_height_m": offshore_wave_height_m,
                "magnitude": request.magnitude,
            },
        }


def wave_speed_mps(depth_m: float) -> float:
    if depth_m <= 0:
        raise ValueError("depth_m must be greater than 0")
    return math.sqrt(GRAVITY_MPS2 * depth_m)


def green_law_height_m(
    *,
    offshore_height_m: float,
    offshore_depth_m: float,
    coastal_depth_m: float,
    amplification_factor: float,
) -> float:
    if offshore_height_m < 0:
        raise ValueError("offshore_height_m must be greater than or equal to 0")
    if offshore_depth_m <= 0:
        raise ValueError("offshore_depth_m must be greater than 0")
    if coastal_depth_m <= 0:
        raise ValueError("coastal_depth_m must be greater than 0")
    if amplification_factor <= 0:
        raise ValueError("amplification_factor must be greater than 0")
    return offshore_height_m * (offshore_depth_m / coastal_depth_m) ** 0.25 * amplification_factor


def path_points(
    source_lon: float,
    source_lat: float,
    target_lon: float,
    target_lat: float,
    count: int,
) -> list[tuple[float, float]]:
    distance_km = haversine_km(source_lon, source_lat, target_lon, target_lat)
    bearing = initial_bearing_deg(source_lon, source_lat, target_lon, target_lat)
    steps = max(count, 2)
    return [
        destination_point(source_lon, source_lat, bearing, distance_km * index / (steps - 1))
        for index in range(steps)
    ]


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def initial_bearing_deg(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def destination_point(lon: float, lat: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    bearing = math.radians(bearing_deg)
    angular_distance = distance_km / EARTH_RADIUS_KM
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return ((math.degrees(lon2) + 540.0) % 360.0) - 180.0, math.degrees(lat2)


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


def _validate_request(request: WavePropagationInput) -> None:
    if not -90 <= request.source_latitude <= 90:
        raise ValueError("source_latitude must be between -90 and 90")
    if not -180 <= request.source_longitude <= 180:
        raise ValueError("source_longitude must be between -180 and 180")
    if request.offshore_wave_height_m is None and request.magnitude is None:
        raise ValueError("offshore_wave_height_m or magnitude is required")
    if request.offshore_wave_height_m is not None and request.offshore_wave_height_m < 0:
        raise ValueError("offshore_wave_height_m must be greater than or equal to 0")
    if request.magnitude is not None and request.magnitude < 0:
        raise ValueError("magnitude must be greater than or equal to 0")
    if request.max_targets <= 0:
        raise ValueError("max_targets must be greater than 0")
    if request.target_spacing_km <= 0:
        raise ValueError("target_spacing_km must be greater than 0")
    if request.coastal_depth_m <= 0:
        raise ValueError("coastal_depth_m must be greater than 0")
    if request.amplification_factor <= 0:
        raise ValueError("amplification_factor must be greater than 0")


__all__ = [
    "WavePropagationEngine",
    "WavePropagationInput",
    "WavePropagationResult",
    "WaveTargetResult",
    "green_law_height_m",
    "haversine_km",
    "path_points",
    "wave_speed_mps",
]
