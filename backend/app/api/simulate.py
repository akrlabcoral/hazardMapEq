"""
app/api/simulate.py

POST /api/simulate-earthquake

Thin route handler — delegates all heavy computation to SimulationRunner.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.api.schemas import EarthquakeInput
from app.core.errors import NotFoundError, ServiceUnavailableError, ValidationError
from app.hazards.earthquake.service import earthquake_service

router = APIRouter()


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
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return {
        "status": "accepted",
        "request_id": request_id,
        "message": "Simulation queued. Listen for simulation_complete over WebSocket.",
    }


@router.get("/region")
async def get_region(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
):
    """
    Given a latitude and longitude, returns the tectonic region string
    e.g., {"region": "HIMALAYA"}
    """
    from app.layers.pga.regions import get_tectonic_region
    region = get_tectonic_region(lat, lon)
    return {"region": region.value}


@router.get("/simulate-earthquake/status/{request_id}")
async def get_simulation_status(request_id: str):
    try:
        return await earthquake_service.get_simulation_status(request_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail="Simulation request not found") from exc
