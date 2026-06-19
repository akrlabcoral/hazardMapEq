from __future__ import annotations

from pydantic import BaseModel, Field


class EarthquakeInput(BaseModel):
    magnitude: float = Field(..., ge=1.0, le=10.0)
    depth: float = Field(..., gt=0, le=10000)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
