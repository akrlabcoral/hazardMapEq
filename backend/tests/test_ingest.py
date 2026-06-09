from __future__ import annotations

from datetime import datetime, timezone

from app.ingest import deduplicator
from app.ingest.ncs_scraper import _parse_ncs_object
from app.ingest.normalizer import compute_fingerprint, normalize_usgs_feature


def test_normalize_usgs_feature_and_fingerprint():
    feature = {
        "id": "abc123",
        "geometry": {"coordinates": [77.2, 28.6, 12]},
        "properties": {
            "mag": 5.4,
            "magType": "Mw",
            "place": "Delhi",
            "status": "reviewed",
            "alert": "green",
            "time": 1760000000000,
        },
    }

    event = normalize_usgs_feature(feature)

    assert event.source_id == "usgs:abc123"
    assert event.source == "USGS"
    assert event.latitude == 28.6
    assert event.longitude == 77.2
    assert event.fingerprint == compute_fingerprint(28.6, 77.2, 5.4, event.origin_time)


def test_parse_ncs_object_converts_ist_to_utc():
    event = _parse_ncs_object({
        "event_id": "ncs1",
        "lat_long": "29.811, 80.490",
        "magnitude_depth": "M: 2.6 , D: 5km",
        "origin_time": "2026-06-01 07:29:24 IST",
        "event_name": "M: 2.6 - Pithoragarh, Uttarakhand",
        "event_type": "Reviewed",
    })

    assert event.source_id == "ncs:ncs1"
    assert event.source == "NCS"
    assert event.origin_time.hour == 1
    assert event.origin_time.minute == 59
    assert event.origin_time.tzinfo == timezone.utc


def test_deduplicator_uses_source_and_fingerprint(monkeypatch):
    calls = {}

    def fake_is_duplicate(source_id, fingerprint):
        calls["checked"] = (source_id, fingerprint)
        return True

    monkeypatch.setattr(deduplicator, "is_duplicate", fake_is_duplicate)

    class Event:
        source_id = "src"
        fingerprint = "fp"

    assert deduplicator.is_seen(Event()) is True
    assert calls["checked"] == ("src", "fp")
