from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Protocol

EARTH_RADIUS_KM = 6371.0088
SHEAR_MODULUS_PA = 3.0e10


@dataclass(frozen=True)
class SourceModelInput:
    magnitude: float
    latitude: float
    longitude: float
    strike_deg: float = 0.0
    dip_deg: float = 15.0
    rake_deg: float = 90.0
    mechanism: str = "thrust"
    depth_km: float = 10.0
    length_km: float | None = None
    width_km: float | None = None
    slip_m: float | None = None


@dataclass(frozen=True)
class SourceModelResult:
    rupture_area_km2: float
    rupture_length_km: float
    rupture_width_km: float
    slip_m: float
    rupture_polygon: dict
    vertical_deformation: dict
    metadata: dict

    def to_dict(self) -> dict:
        return {
            "rupture_area_km2": self.rupture_area_km2,
            "rupture_length_km": self.rupture_length_km,
            "rupture_width_km": self.rupture_width_km,
            "slip_m": self.slip_m,
            "rupture_polygon": self.rupture_polygon,
            "vertical_deformation": self.vertical_deformation,
            "metadata": self.metadata,
        }


class SourceModel(Protocol):
    def model(self, source: SourceModelInput) -> SourceModelResult:
        ...


class OkadaSourceModel:
    """Fast rectangular tsunami source model.

    V1 uses Wells & Coppersmith reverse-fault scaling and an Okada-inspired
    elliptical vertical-deformation approximation. It is intentionally modular
    so a full elastic dislocation solver can replace it later.
    """

    deformation_grid_size = 7

    def model(self, source: SourceModelInput) -> SourceModelResult:
        _validate_source(source)

        length_km = source.length_km or wells_coppersmith_length_km(source.magnitude)
        width_km = source.width_km or wells_coppersmith_width_km(source.magnitude)
        area_km2 = length_km * width_km
        slip_m = source.slip_m or estimate_slip_m(source.magnitude, area_km2)

        polygon = rupture_polygon(
            longitude=source.longitude,
            latitude=source.latitude,
            length_km=length_km,
            width_km=width_km,
            strike_deg=source.strike_deg,
            dip_deg=source.dip_deg,
            properties={
                "model": "okada_approximation",
                "mechanism": source.mechanism,
                "magnitude": source.magnitude,
                "depth_km": source.depth_km,
                "length_km": length_km,
                "width_km": width_km,
                "slip_m": slip_m,
            },
        )
        deformation = vertical_deformation_points(
            longitude=source.longitude,
            latitude=source.latitude,
            length_km=length_km,
            width_km=width_km,
            strike_deg=source.strike_deg,
            dip_deg=source.dip_deg,
            rake_deg=source.rake_deg,
            depth_km=source.depth_km,
            slip_m=slip_m,
            grid_size=self.deformation_grid_size,
        )

        return SourceModelResult(
            rupture_area_km2=area_km2,
            rupture_length_km=length_km,
            rupture_width_km=width_km,
            slip_m=slip_m,
            rupture_polygon=polygon,
            vertical_deformation=deformation,
            metadata={
                "source_model": "OkadaSourceModel",
                "scaling_relation": "Wells & Coppersmith 1994 reverse/thrust fault",
                "deformation_model": "Okada-inspired elliptical approximation",
                "is_full_okada_solver": False,
                "units": {
                    "rupture_area": "km^2",
                    "rupture_length": "km",
                    "rupture_width": "km",
                    "slip": "m",
                    "vertical_deformation": "m",
                },
            },
        )


def wells_coppersmith_length_km(magnitude: float) -> float:
    # Wells & Coppersmith reverse-fault surface rupture length relation.
    return 10 ** (-2.42 + 0.58 * magnitude)


def wells_coppersmith_width_km(magnitude: float) -> float:
    # Wells & Coppersmith reverse-fault down-dip rupture width relation.
    return 10 ** (-1.61 + 0.41 * magnitude)


def estimate_slip_m(magnitude: float, area_km2: float) -> float:
    seismic_moment_nm = 10 ** (1.5 * magnitude + 9.1)
    area_m2 = area_km2 * 1_000_000.0
    return seismic_moment_nm / (SHEAR_MODULUS_PA * area_m2)


def rupture_polygon(
    *,
    longitude: float,
    latitude: float,
    length_km: float,
    width_km: float,
    strike_deg: float,
    dip_deg: float,
    properties: dict,
) -> dict:
    half_length = length_km / 2.0
    half_surface_width = max((width_km * math.cos(math.radians(dip_deg))) / 2.0, 0.001)
    along = strike_deg
    across = strike_deg + 90.0

    corners = [
        _offset_point(longitude, latitude, -half_length, -half_surface_width, along, across),
        _offset_point(longitude, latitude, half_length, -half_surface_width, along, across),
        _offset_point(longitude, latitude, half_length, half_surface_width, along, across),
        _offset_point(longitude, latitude, -half_length, half_surface_width, along, across),
    ]
    corners.append(corners[0])
    return {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [corners]},
        "properties": properties,
    }


def vertical_deformation_points(
    *,
    longitude: float,
    latitude: float,
    length_km: float,
    width_km: float,
    strike_deg: float,
    dip_deg: float,
    rake_deg: float,
    depth_km: float,
    slip_m: float,
    grid_size: int,
) -> dict:
    features = []
    half_length = length_km / 2.0
    half_surface_width = max((width_km * math.cos(math.radians(dip_deg))) / 2.0, 0.001)
    along = strike_deg
    across = strike_deg + 90.0
    rake_factor = max(math.sin(math.radians(rake_deg)), 0.0)
    dip_factor = math.sin(math.radians(dip_deg))
    peak = slip_m * dip_factor * rake_factor * math.exp(-depth_km / 60.0)

    steps = max(grid_size, 3)
    for i in range(steps):
        along_norm = -1.0 + (2.0 * i / (steps - 1))
        for j in range(steps):
            across_norm = -1.0 + (2.0 * j / (steps - 1))
            along_km = along_norm * length_km
            across_km = across_norm * width_km
            lon, lat = _offset_point(
                longitude,
                latitude,
                along_km,
                across_km,
                along,
                across,
            )
            normalized_radius = (along_norm / 1.25) ** 2 + (across_norm / 0.9) ** 2
            sign = 1.0 if across_norm >= 0 else -0.45
            deformation_m = peak * sign * math.exp(-2.2 * normalized_radius)
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "vertical_deformation_m": deformation_m,
                    "model": "okada_approximation",
                },
            })

    return {
        "type": "FeatureCollection",
        "features": features,
        "properties": {
            "model": "okada_approximation",
            "description": "Approximate vertical deformation sample points, not a full Okada elastic solver.",
        },
    }


def _offset_point(
    longitude: float,
    latitude: float,
    along_km: float,
    across_km: float,
    along_bearing_deg: float,
    across_bearing_deg: float,
) -> list[float]:
    distance_km = math.hypot(along_km, across_km)
    if distance_km == 0:
        return [longitude, latitude]
    bearing_rad = math.atan2(
        along_km * math.sin(math.radians(along_bearing_deg))
        + across_km * math.sin(math.radians(across_bearing_deg)),
        along_km * math.cos(math.radians(along_bearing_deg))
        + across_km * math.cos(math.radians(across_bearing_deg)),
    )
    return list(_destination_point(longitude, latitude, math.degrees(bearing_rad), distance_km))


def _destination_point(longitude: float, latitude: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    bearing = math.radians(bearing_deg)
    angular_distance = distance_km / EARTH_RADIUS_KM
    lat1 = math.radians(latitude)
    lon1 = math.radians(longitude)

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    lon = ((math.degrees(lon2) + 540.0) % 360.0) - 180.0
    lat = math.degrees(lat2)
    return lon, lat


def _validate_source(source: SourceModelInput) -> None:
    if source.magnitude < 0:
        raise ValueError("magnitude must be greater than or equal to 0")
    if not -90 <= source.latitude <= 90:
        raise ValueError("latitude must be between -90 and 90")
    if not -180 <= source.longitude <= 180:
        raise ValueError("longitude must be between -180 and 180")
    if not 0 < source.dip_deg <= 90:
        raise ValueError("dip_deg must be greater than 0 and less than or equal to 90")
    if source.depth_km < 0:
        raise ValueError("depth_km must be greater than or equal to 0")
    for name in ("length_km", "width_km", "slip_m"):
        value = getattr(source, name)
        if value is not None and value <= 0:
            raise ValueError(f"{name} must be greater than 0 when provided")
