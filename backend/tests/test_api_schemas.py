from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.schemas import EarthquakeInput


def _valid_payload(**overrides):
    payload = {
        "magnitude": 5.0,
        "depth": 10.0,
        "latitude": 28.6,
        "longitude": 77.2,
    }
    payload.update(overrides)
    return payload


def test_earthquake_input_accepts_known_gmpe_params():
    params = EarthquakeInput(**_valid_payload(gmpe_params={"c1": 1.35, "c2": 0.5, "c3": 0.0, "c4": -0.005, "C": 1.0}))

    assert params.gmpe_params["c1"] == 1.35


def test_earthquake_input_rejects_unknown_or_unbounded_gmpe_params():
    with pytest.raises(ValidationError):
        EarthquakeInput(**_valid_payload(gmpe_params={"bad": 1.0}))

    with pytest.raises(ValidationError):
        EarthquakeInput(**_valid_payload(gmpe_params={"c1": float("inf")}))

    with pytest.raises(ValidationError):
        EarthquakeInput(**_valid_payload(gmpe_params={"c1": 1001.0}))
