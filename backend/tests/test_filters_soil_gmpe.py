from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.ingest.filter import is_relevant
from app.ingest.normalizer import EarthquakeEvent
from app.layers.pga.gmpe import CustomOverrideGMPE
from app.layers.pga.selector import GMPESelector
from app.soil.amplification import get_amplification_batch, get_amplification_factor
from app.soil.site_class import get_site_class, get_site_classes_batch


def _event(**overrides):
    base = dict(
        source_id="s",
        source="TEST",
        fingerprint="f",
        latitude=28.6,
        longitude=77.2,
        depth_km=10,
        magnitude=4.5,
        mag_type="Mw",
        origin_time=datetime.now(timezone.utc),
        place="Delhi",
        status="reviewed",
        alert_level=None,
    )
    base.update(overrides)
    return EarthquakeEvent(**base)


def test_relevance_filter_rejects_deep_events():
    assert is_relevant(_event(depth_km=301)) is False


def test_custom_gmpe_override_is_preserved():
    gmpe, _region = GMPESelector.select(28.6, 77.2, {"c1": 1.0})
    assert isinstance(gmpe, CustomOverrideGMPE)


def test_soil_class_and_amplification_batch():
    assert get_site_class(1600) == "A"
    assert get_site_class(500) == "C"
    assert get_amplification_factor("E") == 2.0
    assert get_site_classes_batch([1600, 500, 100]) == ["A", "C", "E"]
    assert get_amplification_batch(["A", "B", "E"]).tolist() == pytest.approx([0.8, 1.0, 2.0])
