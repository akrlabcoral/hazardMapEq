from __future__ import annotations

from typing import Any

from app.hazards.tsunami.schemas import (
    TsunamiAnalysisRequest,
    TsunamiDamageAssessmentRequest,
    TsunamiInundationRequest,
    TsunamiWavePropagationRequest,
)


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
        "simulation_id": request_id,
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

    layers = {
        "source_marker": _source_marker(inputs),
        "rupture_polygon": source.get("rupture_polygon"),
        "vertical_deformation_points": source.get("vertical_deformation"),
        "wave_targets": _wave_targets_feature_collection(wave),
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
