from __future__ import annotations

from datetime import datetime, timezone

from app.hazards.earthquake.ingest.normalizer import EarthquakeEvent
from app.hazards.tsunami.trigger_engine import TsunamiThreatLevel, evaluate_tsunami_trigger


def _event(
    *,
    magnitude: float,
    depth_km: float,
    latitude: float = 14.0,
    longitude: float = 88.0,
    mechanism: str | None = None,
) -> EarthquakeEvent:
    event = EarthquakeEvent(
        source_id="test:event",
        source="TEST",
        fingerprint="fp",
        latitude=latitude,
        longitude=longitude,
        depth_km=depth_km,
        magnitude=magnitude,
        mag_type="Mw",
        origin_time=datetime(2026, 6, 1, tzinfo=timezone.utc),
        place="Test event",
        status="reviewed",
        alert_level=None,
    )
    if mechanism is not None:
        setattr(event, "mechanism", mechanism)
    return event


def test_magnitude_below_threshold_inside_bay_does_not_trigger():
    result = evaluate_tsunami_trigger(_event(magnitude=6.4, depth_km=20))

    assert result.is_triggered is False
    assert result.threat_level is None
    assert result.matched_region == "Bay of Bengal"


def test_threshold_event_inside_bay_with_unknown_mechanism_returns_watch():
    result = evaluate_tsunami_trigger(_event(magnitude=6.5, depth_km=70))

    assert result.is_triggered is True
    assert result.threat_level == TsunamiThreatLevel.WATCH
    assert result.to_dict()["threat_level"] == "WATCH"


def test_shallow_m78_inside_andaman_returns_warning():
    result = evaluate_tsunami_trigger(
        _event(magnitude=7.8, depth_km=30, latitude=10.0, longitude=93.0)
    )

    assert result.is_triggered is True
    assert result.threat_level == TsunamiThreatLevel.WARNING
    assert result.matched_region == "Andaman region"


def test_m86_inside_bay_returns_evacuation_level():
    result = evaluate_tsunami_trigger(_event(magnitude=8.6, depth_km=40))

    assert result.is_triggered is True
    assert result.threat_level == TsunamiThreatLevel.EVACUATE


def test_event_deeper_than_70_km_does_not_trigger():
    result = evaluate_tsunami_trigger(_event(magnitude=7.5, depth_km=71))

    assert result.is_triggered is False
    assert result.reason == "Earthquake depth is greater than 70 km"


def test_explicit_non_thrust_mechanism_does_not_trigger():
    result = evaluate_tsunami_trigger(
        _event(magnitude=7.5, depth_km=20, mechanism="strike-slip")
    )

    assert result.is_triggered is False
    assert result.reason == "Focal mechanism is not thrust or unknown"
    assert result.mechanism == "strike-slip"


def test_valid_event_outside_trigger_regions_does_not_trigger():
    result = evaluate_tsunami_trigger(
        _event(magnitude=8.0, depth_km=10, latitude=28.6, longitude=77.2)
    )

    assert result.is_triggered is False
    assert result.matched_region is None
