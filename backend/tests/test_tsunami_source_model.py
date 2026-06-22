from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

from app.hazards.tsunami.models.okada_model import OkadaSourceModel, SourceModelInput
from app.hazards.tsunami.schemas import TsunamiSourceModelRequest
from app.hazards.tsunami.service import tsunami_service
from app.main import app


def test_source_model_scaling_outputs_are_positive():
    result = OkadaSourceModel().model(SourceModelInput(magnitude=8.0, latitude=10.0, longitude=92.0))

    assert result.rupture_length_km > 0
    assert result.rupture_width_km > 0
    assert result.rupture_area_km2 == pytest.approx(result.rupture_length_km * result.rupture_width_km)
    assert result.slip_m > 0


def test_source_model_respects_optional_overrides():
    result = OkadaSourceModel().model(
        SourceModelInput(
            magnitude=7.5,
            latitude=10.0,
            longitude=92.0,
            length_km=100,
            width_km=50,
            slip_m=2.5,
        )
    )

    assert result.rupture_length_km == 100
    assert result.rupture_width_km == 50
    assert result.rupture_area_km2 == 5000
    assert result.slip_m == 2.5


def test_source_model_returns_closed_geojson_polygon():
    result = OkadaSourceModel().model(SourceModelInput(magnitude=7.8, latitude=10.0, longitude=92.0))
    polygon = result.rupture_polygon
    ring = polygon["geometry"]["coordinates"][0]

    assert polygon["type"] == "Feature"
    assert polygon["geometry"]["type"] == "Polygon"
    assert len(ring) == 5
    assert ring[0] == ring[-1]


def test_source_model_vertical_deformation_is_geojson_with_finite_values():
    result = OkadaSourceModel().model(SourceModelInput(magnitude=7.8, latitude=10.0, longitude=92.0))
    deformation = result.vertical_deformation

    assert deformation["type"] == "FeatureCollection"
    assert deformation["features"]
    for feature in deformation["features"]:
        value = feature["properties"]["vertical_deformation_m"]
        assert math.isfinite(value)
        assert feature["geometry"]["type"] == "Point"


def test_source_model_schema_rejects_invalid_inputs():
    with pytest.raises(ValidationError):
        TsunamiSourceModelRequest(magnitude=-1, latitude=10, longitude=92)
    with pytest.raises(ValidationError):
        TsunamiSourceModelRequest(magnitude=7, latitude=91, longitude=92)
    with pytest.raises(ValidationError):
        TsunamiSourceModelRequest(magnitude=7, latitude=10, longitude=92, dip_deg=0)
    with pytest.raises(ValidationError):
        TsunamiSourceModelRequest(magnitude=7, latitude=10, longitude=92, length_km=0)


def test_tsunami_service_source_model_response_shape():
    response = tsunami_service.model_source(
        TsunamiSourceModelRequest(
            magnitude=8.1,
            latitude=10.0,
            longitude=92.0,
            strike_deg=20,
            length_km=120,
            width_km=60,
        )
    )

    assert response.rupture_area_km2 == pytest.approx(7200)
    assert response.rupture_polygon["geometry"]["type"] == "Polygon"
    assert response.vertical_deformation["type"] == "FeatureCollection"
    assert response.metadata["is_full_okada_solver"] is False
    assert response.inputs.magnitude == 8.1


def test_tsunami_source_model_route_is_registered():
    paths = {getattr(route, "path", "") for route in app.routes}

    assert "/api/hazards/tsunami/source-model" in paths
    assert "/api/hazards/tsunami/calculate" in paths
