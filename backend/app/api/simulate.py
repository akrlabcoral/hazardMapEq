"""
app/api/simulate.py

POST /api/simulate-earthquake

Thin route handler — delegates all heavy computation to SimulationRunner.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict

from app.gis.boundary import is_epicenter_valid
from app.jobs.simulation_worker import SimulationRunner

router = APIRouter()


class EarthquakeInput(BaseModel):
    magnitude:   float            = Field(..., ge=1.0, le=10.0)
    depth:       float            = Field(..., gt=0,   le=10000)
    latitude:    float            = Field(..., ge=-90.0,  le=90.0)
    longitude:   float            = Field(..., ge=-180.0, le=180.0)
    weights:     Dict[str, float] = Field(default={"pga": 1.0})
    gmpe_params: Dict[str, float] | None = Field(
        default=None,
        description="Optional custom GMPE polynomial parameters. If omitted, automatically selects based on region."
    )


@router.post("/simulate-earthquake")
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
        # Run the simulation in a thread pool so the event loop stays free
        # during the 2-3s blocking contour generation step.
        result = await asyncio.to_thread(
            SimulationRunner.run,
            latitude     = params.latitude,
            longitude    = params.longitude,
            magnitude    = params.magnitude,
            depth_km     = params.depth,
            gmpe_params  = params.gmpe_params,
            triggered_by = "manual",
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/region")
async def get_region(lat: float, lon: float):
    """
    Given a latitude and longitude, returns the tectonic region string
    e.g., {"region": "HIMALAYA"}
    """
    from app.layers.pga.regions import get_tectonic_region
    region = get_tectonic_region(lat, lon)
    return {"region": region.value}
