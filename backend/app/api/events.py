"""
app/api/events.py

REST endpoints for earthquake events.

GET /api/events          — list 50 most recent events (metadata only)
GET /api/events/{id}     — single event with linked simulation if any
GET /api/health          — poller + queue + WS status
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.repository import get_recent_events, get_earthquake_event
from app.ingest.poller import poller_stats
from app.jobs.queue import get_queue
from app.api.ws import client_count

router = APIRouter()


@router.get("/events")
def list_events(limit: int = Query(50, ge=1, le=200)):
    """Return the N most recent earthquake events, newest first."""
    events = get_recent_events(limit=limit)
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
