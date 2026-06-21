from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class EarthquakeInput(BaseModel):
    magnitude: float = Field(..., ge=1.0, le=10.0)
    depth: float = Field(..., gt=0, le=10000)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

    @model_validator(mode="before")
    @classmethod
    def reject_removed_gmpe_override(cls, data):
        if isinstance(data, dict) and "gmpe_params" in data:
            raise ValueError("gmpe_params is no longer supported; GMPE is selected automatically by region")
        return data

