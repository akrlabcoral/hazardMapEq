from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

from app.hazards.base.registry import hazard_registry
from app.hazards.tsunami import formulas
from app.hazards.tsunami.schemas import TsunamiCalculationRequest
from app.hazards.tsunami.service import tsunami_service
from app.main import app


def test_tsunami_formula_outputs():
    speed = formulas.tsunami_velocity_mps(4000)
    assert speed == pytest.approx(math.sqrt(9.81 * 4000))
    assert formulas.tsunami_wavelength_m(1200, 4000) == pytest.approx(1200 * speed)
    assert formulas.initial_wave_height_m(2.4) == pytest.approx(1.2)
    assert formulas.abe_tsunami_magnitude(1.5, 100) == pytest.approx(math.log10(1.5) + 2 + 5.80)
    assert formulas.runup_height_m(1.5, 3) == pytest.approx(4.5)


@pytest.mark.parametrize(
    ("magnitude", "level"),
    [
        (6.4, "Very Low"),
        (6.5, "Low"),
        (7.0, "Moderate"),
        (7.5, "High"),
        (8.1, "Very High"),
    ],
)
def test_tsunami_potential_classification(magnitude, level):
    assert formulas.classify_tsunami_potential(magnitude)["level"] == level


def test_tsunami_rejects_invalid_log_inputs():
    with pytest.raises(ValidationError, match="wave_height_m must be greater than 0"):
        TsunamiCalculationRequest(magnitude=7.2, wave_height_m=0, distance_km=100)
    with pytest.raises(ValidationError, match="distance_km must be greater than 0"):
        TsunamiCalculationRequest(magnitude=7.2, wave_height_m=1, distance_km=0)


def test_tsunami_service_response_shape():
    result = tsunami_service.calculate(
        TsunamiCalculationRequest(
            magnitude=7.2,
            depth_m=4000,
            period_s=1200,
            seabed_displacement_m=2,
            wave_height_m=1.5,
            distance_km=100,
            amplification_factor=3,
            latitude=14.5,
            longitude=88.5,
        )
    )

    assert result.tsunami_speed_mps > 0
    assert result.tsunami_speed_kmh == pytest.approx(result.tsunami_speed_mps * 3.6)
    assert result.wavelength_m > 0
    assert result.initial_wave_height_m == pytest.approx(1.0)
    assert result.estimated_runup_m == pytest.approx(4.5)
    assert result.tsunami_potential_class.level == "Moderate"
    assert "official warning" in result.explanation


def test_tsunami_plugin_is_registered():
    assert hazard_registry.get("tsunami") is not None
    paths = {getattr(route, "path", "") for route in app.routes}
    assert "/api/hazards/tsunami/calculate" in paths
