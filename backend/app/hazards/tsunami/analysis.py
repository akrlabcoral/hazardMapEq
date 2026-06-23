from __future__ import annotations

import json
import logging
import math
from typing import Any

import geojsoncontour
import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from app.hazards.tsunami.schemas import (
    TsunamiAnalysisRequest,
    TsunamiDamageAssessmentRequest,
    TsunamiInundationRequest,
    TsunamiWavePropagationRequest,
)

logger = logging.getLogger(__name__)
EMPTY_FEATURE_COLLECTION = {"type": "FeatureCollection", "features": []}

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


def _travel_time_line_features(epicenter_lon: float, epicenter_lat: float, levels: list[int]) -> list[dict[str, Any]]:
    features = []
    for level in levels:
        if level <= 0:
            continue
        radius_km = level * 750.0
        coordinates = [
            _destination_point(epicenter_lon, epicenter_lat, bearing, radius_km)
            for bearing in range(0, 361, 4)
        ]
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coordinates},
            "properties": {
                "travel_time_hours": f"{level}h",
                "stroke": "#ffffff",
                "stroke-width": 1.5,
            },
        })
    return features


def generate_ttt_geojson(epicenter_lon: float | None, epicenter_lat: float | None) -> dict:
    if epicenter_lon is None or epicenter_lat is None:
        return EMPTY_FEATURE_COLLECTION

    # 1. Create a large grid around epicenter
    N = 100
    lon_min, lon_max = epicenter_lon - 60, epicenter_lon + 60
    lat_min, lat_max = epicenter_lat - 60, epicenter_lat + 60
    grid_lon, grid_lat = np.mgrid[lon_min:lon_max:complex(N), lat_min:lat_max:complex(N)]

    # 2. Calculate travel time in hours
    # Approximation: Tsunami in deep ocean travels ~750 km/h
    dist_km = haversine_dist(epicenter_lon, epicenter_lat, grid_lon, grid_lat)
    time_hours = dist_km / 750.0

    # 3. Contour levels and colors (Red to Blue)
    levels = [0, 2, 4, 6, 8, 10, 15, 20, 25, 30]
    line_levels = [2, 5, 10, 20]
    colors = [
        "#d73027", "#f46d43", "#fdae61", "#fee090", 
        "#e0f3f8", "#abd9e9", "#74add1", "#4575b4", "#313695"
    ]

    try:
        fig, ax = plt.subplots()
        contour = ax.contourf(grid_lon, grid_lat, time_hours, levels=levels, colors=colors, extend="max")
        contour_geojson_str = geojsoncontour.contourf_to_geojson(
            contourf=contour,
            ndigits=3,
            stroke_width=1,
            fill_opacity=0.4
        )
        plt.close(fig)
        
        geojson = json.loads(contour_geojson_str)
        # Annotate with travel time properties for frontend labels
        for feature in geojson.get("features", []):
            title = feature.get("properties", {}).get("title", "")
            # "title" format is "0.00-2.00"
            if "-" in title:
                end_hr = title.split("-")[1]
                feature["properties"]["travel_time_hours"] = end_hr
        geojson.setdefault("features", []).extend(
            _travel_time_line_features(epicenter_lon, epicenter_lat, line_levels)
        )
        return geojson
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
