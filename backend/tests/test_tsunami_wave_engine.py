from __future__ import annotations

import math

import pytest
from shapely.geometry import LineString

from app.hazards.tsunami.models.wave_engine import (
    WavePropagationEngine,
    WavePropagationInput,
    green_law_height_m,
    wave_speed_mps,
)
from app.hazards.tsunami.schemas import TsunamiWavePropagationRequest
from app.hazards.tsunami.service import TsunamiService
from app.main import app


class FakeBathymetry:
    def __init__(self, depth_m: float = 4000, available: bool = True) -> None:
        self.depth_m = depth_m
        self.available = available

    def is_available(self) -> bool:
        return self.available

    def sample_depths_m(self, coords):
        return [self.depth_m for _ in coords]


class FakeCoastline:
    def __init__(self, available: bool = True) -> None:
        self.available = available

    def is_available(self) -> bool:
        return self.available

    def get_geometry(self):
        return LineString([(1.0, 0.0), (1.0, 1.0)])


class FakeAdminBoundaries:
    def __init__(self, available: bool = True) -> None:
        self.available = available

    def is_available(self) -> bool:
        return self.available

    def find_metadata(self, lon, lat):
        return {"DISTRICT": "Dynamic Coast", "COUNTRY": "Testland", "lon": lon, "lat": lat}


def _engine(depth_m: float = 4000) -> WavePropagationEngine:
    return WavePropagationEngine(
        bathymetry=FakeBathymetry(depth_m=depth_m),
        coastline=FakeCoastline(),
        admin_boundaries=FakeAdminBoundaries(),
    )


def test_missing_required_gis_data_returns_unavailable():
    engine = WavePropagationEngine(
        bathymetry=FakeBathymetry(available=False),
        coastline=FakeCoastline(),
        admin_boundaries=FakeAdminBoundaries(),
    )

    result = engine.propagate(
        WavePropagationInput(source_latitude=0, source_longitude=0, offshore_wave_height_m=1)
    )

    assert result.is_available is False
    assert result.targets == []
    assert "Bathymetry raster" in result.metadata["reason"]


def test_wave_speed_uses_shallow_water_formula():
    assert wave_speed_mps(4000) == pytest.approx(math.sqrt(9.81 * 4000))


def test_eta_decreases_when_average_depth_increases():
    shallow = _engine(depth_m=100).propagate(
        WavePropagationInput(
            source_latitude=0,
            source_longitude=0,
            offshore_wave_height_m=1,
            max_targets=1,
        )
    )
    deep = _engine(depth_m=4000).propagate(
        WavePropagationInput(
            source_latitude=0,
            source_longitude=0,
            offshore_wave_height_m=1,
            max_targets=1,
        )
    )

    assert shallow.is_available is True
    assert deep.is_available is True
    assert deep.targets[0].eta_minutes < shallow.targets[0].eta_minutes


def test_green_law_height_is_positive_and_finite():
    height = green_law_height_m(
        offshore_height_m=1,
        offshore_depth_m=4000,
        coastal_depth_m=10,
        amplification_factor=1.5,
    )

    assert height > 0
    assert math.isfinite(height)


def test_dynamic_targets_use_admin_metadata_without_hardcoded_cities():
    result = _engine(depth_m=4000).propagate(
        WavePropagationInput(
            source_latitude=0,
            source_longitude=0,
            offshore_wave_height_m=1,
            max_targets=2,
        )
    )

    assert result.is_available is True
    assert result.targets
    assert result.targets[0].admin_metadata["DISTRICT"] == "Dynamic Coast"
    assert "city" not in result.targets[0].target["properties"]


def test_wave_propagation_service_response_shape_with_injected_engine():
    service = TsunamiService(wave_engine=_engine(depth_m=4000))

    response = service.propagate_wave(
        TsunamiWavePropagationRequest(
            source_latitude=0,
            source_longitude=0,
            offshore_wave_height_m=1,
            max_targets=1,
        )
    )

    assert response.is_available is True
    assert len(response.targets) == 1
    assert response.inputs.source_latitude == 0


def test_tsunami_wave_propagation_route_is_registered():
    paths = {getattr(route, "path", "") for route in app.routes}

    assert "/api/hazards/tsunami/wave-propagation" in paths
    assert "/api/hazards/tsunami/calculate" in paths
    assert "/api/hazards/tsunami/source-model" in paths
