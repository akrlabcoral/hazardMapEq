"""
app/api/simulate.py

POST /api/simulate-earthquake

Thin route handler — delegates all heavy computation to SimulationRunner.
"""
from __future__ import annotations

import asyncio
from fastapi import APIRouter, HTTPException, Query, status

from app.api.schemas import EarthquakeInput
from app.gis.boundary import is_epicenter_valid
from app.jobs.queue import get_queue
from app.models.simulation_job_repository import get_simulation_job

router = APIRouter()


@router.post("/simulate-earthquake", status_code=status.HTTP_202_ACCEPTED)
async def simulate_earthquake(params: EarthquakeInput):
    # Validate epicenter is within the India region (includes buffer for
    # nearby subduction zones — Nepal, Andaman, Bay of Bengal, etc.)
    if not is_epicenter_valid(params.latitude, params.longitude):
        raise HTTPException(
            status_code=422,
            detail=(
                "Epicenter is outside the supported region. "
                "HazardMap covers India and a ~1000 km buffer zone around it."
            ),
        )

    try:
        request_id = await asyncio.to_thread(
            get_queue().enqueue_manual,
            latitude=params.latitude,
            longitude=params.longitude,
            magnitude=params.magnitude,
            depth_km=params.depth,
            gmpe_params=params.gmpe_params,
        )
        return {
            "status": "accepted",
            "request_id": request_id,
            "message": "Simulation queued. Listen for simulation_complete over WebSocket.",
        }
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

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
    job = await asyncio.to_thread(get_simulation_job, request_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Simulation request not found")
    return job
