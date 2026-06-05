"""
app/api/events.py

REST endpoints for earthquake events.

GET /api/events          — list 50 most recent events (metadata only)
GET /api/events/{id}     — single event with linked simulation if any
GET /api/health          — poller + queue + WS status
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.repository import get_recent_events, get_earthquake_event
from app.ingest.poller import poller_stats
from app.jobs.queue import get_queue
from app.api.ws import client_count

router = APIRouter()


@router.get("/events")
def list_events(limit: int = 50):
    """Return the N most recent earthquake events, newest first."""
    events = get_recent_events(limit=min(limit, 200))
    return {"events": events, "count": len(events)}


@router.get("/events/{event_id}")
def get_event(event_id: int):
    """Return a single earthquake event by ID."""
    event = get_earthquake_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event


@router.get("/health")
def health():
    """System health — poller status, queue depth, WS clients."""
    return {
        "status": "ok",
        "poller": poller_stats,
        "queue_depth": get_queue().qsize(),
        "ws_clients": client_count(),
        "db": "postgresql",
    }


# ── Test endpoint — broadcasts a mock earthquake event via WebSocket ───
from datetime import datetime, timezone
from app.api.ws import broadcast
from app.jobs.queue import enqueue
from app.ingest.normalizer import EarthquakeEvent

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
