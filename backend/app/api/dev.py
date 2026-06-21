"""
Development/testing endpoints.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.api.ws import broadcast
from app.hazards.earthquake.ingest import EarthquakeEvent, event_to_payload
from app.hazards.earthquake.jobs import enqueue

router = APIRouter()


@router.post("/test-event")
async def test_event():
    """Broadcast a mock earthquake event and queue it for auto-simulation."""
    now = datetime.now(timezone.utc)
    mock_id = f"mock-{int(now.timestamp())}"

    eq = EarthquakeEvent(
        source_id=mock_id,
        source="TEST",
        fingerprint=f"test-{mock_id}",
        magnitude=6.2,
        latitude=28.6139,
        longitude=77.2090,
        depth_km=15,
        mag_type="Mw",
        origin_time=now,
        place="Near New Delhi, India",
        status="reviewed",
        alert_level="orange",
    )

    await broadcast({
        "type": "earthquake_detected",
        "event": event_to_payload(eq),
    })
    await enqueue(eq)

    return {"status": "broadcasted_and_queued", "event": event_to_payload(eq)}
