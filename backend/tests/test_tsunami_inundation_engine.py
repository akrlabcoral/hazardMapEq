from __future__ import annotations

import math

import pytest
from shapely.geometry import LineString

from app.hazards.tsunami.models.inundation_engine import (
    InundationEngine,
    InundationInput,
    synolakis_runup_height_m,
)
from app.hazards.tsunami.schemas import TsunamiInundationRequest
from app.hazards.tsunami.service import TsunamiService
from app.main import app


class FakeTerrain:
    def __init__(self, available: bool = True) -> None:
        self.available = available

    def is_available(self) -> bool:
        return self.available

    def sample_elevations_m(self, coords):
        return [index * 0.05 for index, _ in enumerate(coords)]


class FakeCoastline:
    def __init__(self, available: bool = True) -> None:
        self.available = available

    def is_available(self) -> bool:
        return self.available

    def get_geometry(self):
        return LineString([(1.0, 0.0), (1.0, 1.0)])


def _engine() -> InundationEngine:
    return InundationEngine(terrain=FakeTerrain(), coastline=FakeCoastline())


def test_missing_dem_returns_unavailable():
    engine = InundationEngine(terrain=FakeTerrain(available=False), coastline=FakeCoastline())

    result = engine.model(InundationInput(wave_height_m=1))

    assert result.is_available is False
    assert result.flood_depth_points["features"] == []
    assert "DEM terrain raster" in result.metadata["reason"]


def test_synolakis_runup_increases_with_wave_height():
    small = synolakis_runup_height_m(1, 0.02)
    large = synolakis_runup_height_m(2, 0.02)

    assert large > small


def test_inundation_engine_derives_positive_flood_depth_and_extent():
    result = _engine().model(
        InundationInput(
            wave_height_m=2,
            source_latitude=0,
            source_longitude=0,
            max_coast_points=2,
            transect_length_km=1,
            transect_spacing_m=100,
            beach_slope=0.02,
        )
    )

    assert result.is_available is True
    assert result.runup_height_m is not None and result.runup_height_m > 0
    assert result.max_flood_depth_m is not None and result.max_flood_depth_m > 0
    assert result.inundation_distance_m is not None and math.isfinite(result.inundation_distance_m)
    assert result.flood_extent_polygon is not None
    assert result.flood_extent_polygon["geometry"]["type"] in {"Polygon", "MultiPolygon"}
    assert result.flood_depth_points["features"]
    assert all(
        feature["properties"]["flood_depth_m"] > 0
        for feature in result.flood_depth_points["features"]
    )


def test_inundation_distance_increases_when_runup_increases():
    low = _engine().model(
        InundationInput(
            wave_height_m=1,
            source_latitude=0,
            source_longitude=0,
            max_coast_points=1,
            transect_length_km=1,
            transect_spacing_m=100,
            beach_slope=0.02,
        )
    )
    high = _engine().model(
        InundationInput(
            wave_height_m=3,
            source_latitude=0,
            source_longitude=0,
            max_coast_points=1,
            transect_length_km=1,
            transect_spacing_m=100,
            beach_slope=0.02,
        )
    )

    assert high.is_available is True
    assert low.is_available is True
    assert high.inundation_distance_m >= low.inundation_distance_m


def test_inundation_service_response_shape_with_injected_engine():
    service = TsunamiService(inundation_engine=_engine())

    response = service.model_inundation(
        TsunamiInundationRequest(
            wave_height_m=2,
            source_latitude=0,
            source_longitude=0,
            max_coast_points=1,
            transect_length_km=1,
            transect_spacing_m=100,
            beach_slope=0.02,
        )
    )

    assert response.is_available is True
    assert response.inputs.wave_height_m == 2
    assert response.flood_depth_points["type"] == "FeatureCollection"


def test_tsunami_inundation_route_is_registered():
    paths = {getattr(route, "path", "") for route in app.routes}

    assert "/api/hazards/tsunami/inundation" in paths
    assert "/api/hazards/tsunami/calculate" in paths
    assert "/api/hazards/tsunami/source-model" in paths
    assert "/api/hazards/tsunami/wave-propagation" in paths
