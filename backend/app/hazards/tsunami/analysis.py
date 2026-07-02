from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np

from app.hazards.tsunami.schemas import (
    TsunamiAnalysisRequest,
    TsunamiDamageAssessmentRequest,
    TsunamiInundationRequest,
    TsunamiWavePropagationRequest,
)
from app.shared.gis.bathymetry_service import bathymetry_service

logger = logging.getLogger(__name__)
EMPTY_FEATURE_COLLECTION = {"type": "FeatureCollection", "features": []}
TSUNAMI_DEEP_WATER_SPEED_KMH = 750.0

def haversine_dist(lon1, lat1, lon2, lat2):
    R = 6371.0
    lon1, lat1, lon2, lat2 = map(np.radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = np.sin(dlat/2.0)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2.0)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c

def _destination_point(lon: float, lat: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    radius_km = 6371.0
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    angular_distance = distance_km / radius_km
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return (math.degrees(lon2), math.degrees(lat2))


def _ocean_only_ring_segments(
    epicenter_lon: float,
    epicenter_lat: float,
    radius_km: float,
    *,
    bearing_step: int = 2,
) -> list[list[tuple[float, float]]]:
    coordinates = [
        _destination_point(epicenter_lon, epicenter_lat, bearing, radius_km)
        for bearing in range(0, 360, bearing_step)
    ]
    depths = bathymetry_service.sample_depths_m(coordinates)
    valid = [depth is not None and depth > 0 for depth in depths]

    segments: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for coord, is_ocean in zip(coordinates + [coordinates[0]], valid + [valid[0]], strict=False):
        if is_ocean:
            current.append(coord)
            continue
        if len(current) >= 2:
            segments.append(current)
        current = []
    if len(current) >= 2:
        segments.append(current)
    return segments


def _travel_time_line_features(epicenter_lon: float, epicenter_lat: float, levels: list[int]) -> list[dict[str, Any]]:
    if not bathymetry_service.is_available():
        logger.warning("TTT contours unavailable: bathymetry raster is not configured or unavailable")
        return []

    features = []
    colors = {
        1: "#d73027",
        2: "#d73027",
        5: "#fdae61",
        10: "#e0f3f8",
        20: "#74add1",
    }
    for level in levels:
        if level <= 0:
            continue
        radius_km = level * TSUNAMI_DEEP_WATER_SPEED_KMH
        for segment in _ocean_only_ring_segments(epicenter_lon, epicenter_lat, radius_km):
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": segment},
                "properties": {
                    "travel_time_hours": f"{level}h",
                    "stroke": "#ffffff",
                    "stroke-width": 1.8,
                    "fill": colors.get(level, "#e0f3f8"),
                    "is_ocean_only": True,
                },
            })
    return features


def _travel_time_band_features(
    epicenter_lon: float,
    epicenter_lat: float,
    bands: list[tuple[float, float, str, float]],
    *,
    bearing_step: int = 5,
    radial_step_km: float = 150.0,
) -> list[dict[str, Any]]:
    if not bathymetry_service.is_available():
        return []

    cells: list[tuple[float, float, float, float, str, float]] = []
    sample_points: list[tuple[float, float]] = []
    for start_hour, end_hour, fill, opacity in bands:
        start_radius = max(0.0, start_hour * TSUNAMI_DEEP_WATER_SPEED_KMH)
        end_radius = max(start_radius, end_hour * TSUNAMI_DEEP_WATER_SPEED_KMH)
        radial_count = max(1, math.ceil((end_radius - start_radius) / radial_step_km))
        for radial_index in range(radial_count):
            inner_radius = start_radius + radial_index * radial_step_km
            outer_radius = min(end_radius, inner_radius + radial_step_km)
            if outer_radius <= inner_radius:
                continue
            for bearing in range(0, 360, bearing_step):
                next_bearing = bearing + bearing_step
                sample_radius = (inner_radius + outer_radius) / 2
                sample_bearing = bearing + bearing_step / 2
                sample_points.append(_destination_point(epicenter_lon, epicenter_lat, sample_bearing, sample_radius))
                cells.append((inner_radius, outer_radius, bearing, next_bearing, fill, opacity))

    depths = bathymetry_service.sample_depths_m(sample_points)
    features: list[dict[str, Any]] = []
    for cell, depth in zip(cells, depths, strict=False):
        if depth is None or depth <= 0:
            continue
        inner_radius, outer_radius, bearing, next_bearing, fill, opacity = cell
        outer_start = _destination_point(epicenter_lon, epicenter_lat, bearing, outer_radius)
        outer_end = _destination_point(epicenter_lon, epicenter_lat, next_bearing, outer_radius)
        if inner_radius <= 0:
            ring = [
                [epicenter_lon, epicenter_lat],
                list(outer_start),
                list(outer_end),
                [epicenter_lon, epicenter_lat],
            ]
        else:
            inner_start = _destination_point(epicenter_lon, epicenter_lat, bearing, inner_radius)
            inner_end = _destination_point(epicenter_lon, epicenter_lat, next_bearing, inner_radius)
            ring = [
                list(inner_start),
                list(outer_start),
                list(outer_end),
                list(inner_end),
                list(inner_start),
            ]
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ring]},
            "properties": {
                "travel_time_hours": f"{int(cell[0] / TSUNAMI_DEEP_WATER_SPEED_KMH)}-{int(math.ceil(cell[1] / TSUNAMI_DEEP_WATER_SPEED_KMH))}h",
                "fill": fill,
                "fill-opacity": opacity,
                "is_ocean_only": True,
                "layer_role": "affected_ocean_area",
            },
        })
    return features


def generate_ttt_geojson(epicenter_lon: float | None, epicenter_lat: float | None) -> dict:
    if epicenter_lon is None or epicenter_lat is None:
        return EMPTY_FEATURE_COLLECTION

    try:
        band_features = _travel_time_band_features(
            epicenter_lon,
            epicenter_lat,
            [
                (0, 1, "#ef4444", 0.22),
                (1, 2, "#fb7185", 0.18),
                (2, 5, "#fbbf24", 0.13),
            ],
        )
        line_features = _travel_time_line_features(epicenter_lon, epicenter_lat, [1, 2, 5, 10, 20])
        features = [*band_features, *line_features]
        if not features:
            return {
                **EMPTY_FEATURE_COLLECTION,
                "properties": {
                    "is_available": False,
                    "reason": "Bathymetry raster is unavailable or no ocean cells intersect TTT rings",
                },
            }
        return {
            "type": "FeatureCollection",
            "features": features,
            "properties": {
                "is_available": True,
                "model": "ocean_only_deep_water_travel_time_bands_and_lines",
                "speed_kmh": TSUNAMI_DEEP_WATER_SPEED_KMH,
            },
        }
    except Exception as e:
        logger.warning("TTT contour failed: %s", e)
        return EMPTY_FEATURE_COLLECTION

def run_tsunami_analysis(request: TsunamiAnalysisRequest, *, request_id: str | None = None) -> dict[str, Any]:
    from app.hazards.tsunami.service import tsunami_service

    source = tsunami_service.model_source(request.source_model)
    source_dict = source.model_dump(mode="json")
    wave_request = request.wave_propagation or TsunamiWavePropagationRequest(
        source_latitude=request.source_model.latitude,
        source_longitude=request.source_model.longitude,
        magnitude=request.source_model.magnitude,
    )
    wave = tsunami_service.propagate_wave(wave_request)
    wave_dict = wave.model_dump(mode="json")

    inundation_request = request.inundation or TsunamiInundationRequest(
        wave_height_m=_default_inundation_wave_height(source_dict, wave_dict),
        source_latitude=request.source_model.latitude,
        source_longitude=request.source_model.longitude,
    )
    inundation = tsunami_service.model_inundation(inundation_request)
    inundation_dict = inundation.model_dump(mode="json")

    damage = None
    if request.include_damage_assessment:
        damage = tsunami_service.assess_damage(
            TsunamiDamageAssessmentRequest(
                flood_extent_polygon=inundation.flood_extent_polygon,
                flood_depth_points=inundation.flood_depth_points,
                runup_height_m=inundation.runup_height_m,
                max_flood_depth_m=inundation.max_flood_depth_m,
                inundation_distance_m=inundation.inundation_distance_m,
            )
        )

    result = {
        "analysis_id": request_id,
        "request_id": request_id,
        "simulation_id": None,
        "hazard_type": "tsunami",
        "source_model": source_dict,
        "wave_propagation": wave_dict,
        "inundation": inundation_dict,
        "damage_assessment": damage.model_dump(mode="json") if damage else None,
        "metadata": {
            "pipeline": "source_model -> wave_propagation -> inundation -> damage_assessment",
            "is_official_warning_model": False,
        },
    }
    result["layers"] = extract_tsunami_layers(result)
    return result


def extract_tsunami_layers(result: dict[str, Any]) -> dict[str, Any]:
    source = result.get("source_model") or {}
    wave = result.get("wave_propagation") or {}
    inundation = result.get("inundation") or {}
    damage = result.get("damage_assessment") or {}
    inputs = source.get("inputs") or {}
    has_wave_targets = bool(wave.get("is_available") and wave.get("targets"))

    layers = {
        "source_marker": _source_marker(inputs),
        "rupture_polygon": source.get("rupture_polygon"),
        "vertical_deformation_points": source.get("vertical_deformation"),
        "wave_targets": _wave_targets_feature_collection(wave),
        "travel_time_contours": generate_ttt_geojson(
            inputs.get("longitude"),
            inputs.get("latitude"),
        ) if has_wave_targets else EMPTY_FEATURE_COLLECTION,
        "flood_extent_polygon": inundation.get("flood_extent_polygon"),
        "flood_depth_points": inundation.get("flood_depth_points"),
        "damage_exposure_summary": {
            "type": "FeatureCollection",
            "features": [],
            "properties": {
                "affected_population": damage.get("affected_population", 0),
                "building_damage": damage.get("building_damage", {}),
                "economic_loss": damage.get("economic_loss", {}),
                "casualty_estimate": damage.get("casualty_estimate", {}),
                "critical_infrastructure_exposure": damage.get("critical_infrastructure_exposure", {}),
            },
        },
    }
    return {key: value for key, value in layers.items() if value is not None}


def _default_inundation_wave_height(source: dict[str, Any], wave: dict[str, Any]) -> float:
    targets = wave.get("targets") or []
    coastal_heights = [
        float(target.get("coastal_wave_height_m"))
        for target in targets
        if target.get("coastal_wave_height_m") is not None
    ]
    if coastal_heights:
        return max(coastal_heights)

    deformation = source.get("vertical_deformation") or {}
    values = [
        float(feature.get("properties", {}).get("vertical_deformation_m"))
        for feature in deformation.get("features", [])
        if feature.get("properties", {}).get("vertical_deformation_m") is not None
    ]
    positives = [value for value in values if value > 0]
    if positives:
        return max(positives)
    return max((abs(value) for value in values), default=0.0)


def _source_marker(inputs: dict[str, Any]) -> dict[str, Any] | None:
    latitude = inputs.get("latitude")
    longitude = inputs.get("longitude")
    if latitude is None or longitude is None:
        return None
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
        "properties": {
            "hazard_type": "tsunami",
            "target_type": "source",
            "magnitude": inputs.get("magnitude"),
        },
    }


def _wave_targets_feature_collection(wave: dict[str, Any]) -> dict[str, Any]:
    features = []
    for target in wave.get("targets") or []:
        feature = dict(target.get("target") or {})
        if not feature:
            continue
        properties = dict(feature.get("properties") or {})
        properties.update({
            "distance_km": target.get("distance_km"),
            "eta_minutes": target.get("eta_minutes"),
            "wave_speed_mps": target.get("wave_speed_mps"),
            "wave_speed_kmh": target.get("wave_speed_kmh"),
            "coastal_wave_height_m": target.get("coastal_wave_height_m"),
            "admin_metadata": target.get("admin_metadata", {}),
        })
        feature["properties"] = properties
        features.append(feature)
    return {"type": "FeatureCollection", "features": features}
