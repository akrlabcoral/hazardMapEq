"""
app/api/events.py

REST endpoints for earthquake events.

GET /api/events               — list 50 most recent events (metadata only)
GET /api/events?region=india  — same, filtered to within ~200 km of India's real border
GET /api/events/{id}          — single event with linked simulation if any
GET /api/health               — poller + queue + WS status
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.core.errors import NotFoundError
from app.hazards.earthquake.service import earthquake_service

router = APIRouter()


@router.get("/events")
def list_events(
    limit: int = Query(50, ge=1, le=200),
    region: str | None = Query(None, description="'india' to filter to within ~200 km of India's border"),
):
    """Return the N most recent earthquake events, newest first.

    When region='india', events are filtered using the real India GeoJSON polygon
    with a 200 km buffer — the same check used to gate automatic simulations.
    """
    return earthquake_service.list_events(limit=limit, region=region)


@router.get("/events/{event_id}")
def get_event(event_id: int):
    """Return a single earthquake event by ID."""
    try:
        return earthquake_service.get_event(event_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found") from exc


@router.get("/health")
def health():
    """System health — poller status, queue depth, WS clients."""
    return earthquake_service.get_health()
