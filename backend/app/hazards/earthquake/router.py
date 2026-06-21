"""Modular earthquake hazard API routes."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import ORJSONResponse

from app.core.errors import NotFoundError, ServiceUnavailableError, ValidationError
from app.hazards.earthquake.schemas import EarthquakeInput
from app.hazards.earthquake.service import earthquake_service

router = APIRouter()


@router.get("/events")
def list_events(
    limit: int = Query(50, ge=1, le=200),
    region: str | None = Query(None, description="'india' to filter to within ~200 km of India's border"),
):
    return earthquake_service.list_events(limit=limit, region=region)


@router.get("/events/{event_id}")
def get_event(event_id: int):
    try:
        return earthquake_service.get_event(event_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/historic")
def get_historic_events(
    request: Request,
    min_magnitude: float | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=100_000),
    bbox: str | None = Query(default=None, description="west,south,east,north"),
):
    try:
        data = earthquake_service.get_historic_events(
            min_magnitude=min_magnitude,
            limit=limit,
            bbox=bbox,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    etag = earthquake_service.historic_etag(data)
    headers = {"Cache-Control": "public, max-age=300", "ETag": etag}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return ORJSONResponse(data, headers=headers)


@router.post("/simulate-earthquake", status_code=status.HTTP_202_ACCEPTED)
async def simulate_earthquake(params: EarthquakeInput):
    try:
        request_id = await earthquake_service.enqueue_manual_simulation(
            latitude=params.latitude,
            longitude=params.longitude,
            magnitude=params.magnitude,
            depth_km=params.depth,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ServiceUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return {
        "status": "accepted",
        "request_id": request_id,
        "message": "Simulation queued. Listen for simulation_complete over WebSocket.",
    }


@router.get("/simulate-earthquake/status/{request_id}")
async def get_simulation_status(request_id: str):
    try:
        return await earthquake_service.get_simulation_status(request_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/region")
async def get_region(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
):
    from app.layers.pga.regions import get_tectonic_region

    region = get_tectonic_region(lat, lon)
    return {"region": region.value}

