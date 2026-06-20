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


def test_earthquake_input_accepts_valid_payload():
    params = EarthquakeInput(**_valid_payload())

    assert params.magnitude == 5.0


def test_earthquake_input_rejects_removed_gmpe_params():
    with pytest.raises(ValidationError):
        EarthquakeInput(**_valid_payload(gmpe_params={"c1": 1.35}))
