from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.hazards.earthquake.ingest import deduplicator
from app.hazards.earthquake.ingest.ncs_scraper import _parse_ncs_object
from app.hazards.earthquake.ingest.normalizer import EarthquakeEvent, compute_fingerprint, normalize_usgs_feature
from app.hazards.earthquake.ingest.processor import process_event


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


def test_deduplicator_try_record_uses_atomic_repository_call(monkeypatch):
    calls = {}

    def fake_try_mark_seen(source_id, fingerprint):
        calls["marked"] = (source_id, fingerprint)
        return False

    monkeypatch.setattr(deduplicator, "try_mark_seen", fake_try_mark_seen)

    class Event:
        source_id = "src"
        fingerprint = "fp"

    assert deduplicator.try_record(Event()) is False
    assert calls["marked"] == ("src", "fp")


def test_process_event_adds_tsunami_trigger_to_existing_broadcast(monkeypatch):
    captured_messages = []

    async def fake_broadcast(message):
        captured_messages.append(message)

    monkeypatch.setattr("app.hazards.earthquake.ingest.processor.broadcast", fake_broadcast)
    monkeypatch.setattr("app.hazards.earthquake.ingest.processor.deduplicator.try_record", lambda event: True)
    monkeypatch.setattr("app.hazards.earthquake.ingest.processor.save_earthquake_event", lambda event: 42)
    monkeypatch.setattr("app.hazards.earthquake.ingest.processor.save_historic_event", lambda event: None)
    monkeypatch.setattr("app.hazards.earthquake.ingest.processor.is_relevant", lambda event: False)

    event = EarthquakeEvent(
        source_id="test:bay",
        source="TEST",
        fingerprint="fp",
        latitude=14.0,
        longitude=88.0,
        depth_km=20.0,
        magnitude=6.8,
        mag_type="Mw",
        origin_time=datetime(2026, 6, 1, tzinfo=timezone.utc),
        place="Bay of Bengal",
        status="reviewed",
        alert_level=None,
    )

    processed, queued = asyncio.run(process_event(event, asyncio.Queue(), "test"))

    assert processed is True
    assert queued is False
    assert captured_messages[0]["type"] == "earthquake_detected"
    tsunami_trigger = captured_messages[0]["event"]["tsunami_trigger"]
    assert tsunami_trigger["is_triggered"] is True
    assert tsunami_trigger["threat_level"] == "WATCH"
    assert tsunami_trigger["matched_region"] == "Bay of Bengal"
