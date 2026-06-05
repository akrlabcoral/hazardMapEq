"""
app/api/tests.py

Testing endpoints, including mock earthquake simulations.
"""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter
from app.api.ws import broadcast
from app.jobs.queue import enqueue
from app.ingest.normalizer import EarthquakeEvent

router = APIRouter()

@router.post("/test-event")
async def test_event():
    """Broadcast a mock earthquake event and queue it for auto-simulation."""
    now = datetime.now(timezone.utc)
    mock_id = f"mock-{int(now.timestamp())}"

    mock_event = {
        "id": mock_id,
        "magnitude": 6.2,
        "latitude": 28.6139,
        "longitude": 77.2090,
        "depth_km": 15,
        "place": "Near New Delhi, India",
        "source": "TEST",
        "origin_time": now.isoformat(),
    }

    # 1. Broadcast the detection alert to all connected clients
    await broadcast({
        "type": "earthquake_detected",
        "event": mock_event,
    })

    # 2. Enqueue for full simulation (worker will broadcast simulation_complete)
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
    await enqueue(eq)

    return {"status": "broadcasted_and_queued", "event": mock_event}
