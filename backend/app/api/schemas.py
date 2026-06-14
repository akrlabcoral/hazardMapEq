from __future__ import annotations

import math

from pydantic import BaseModel, Field, field_validator


ALLOWED_GMPE_PARAM_KEYS = {"c1", "c2", "c3", "c4", "C"}
MAX_ABS_GMPE_PARAM = 1000.0


class EarthquakeInput(BaseModel):
    magnitude: float = Field(..., ge=1.0, le=10.0)
    depth: float = Field(..., gt=0, le=10000)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    gmpe_params: dict[str, float] | None = Field(
        default=None,
        description="Optional custom GMPE polynomial parameters. If omitted, automatically selects based on region.",
    )

    @field_validator("gmpe_params")
    @classmethod
    def validate_gmpe_params(cls, value: dict[str, float] | None) -> dict[str, float] | None:
        if value is None:
            return None

        unknown_keys = set(value) - ALLOWED_GMPE_PARAM_KEYS
        if unknown_keys:
            raise ValueError(f"Unsupported GMPE parameter(s): {', '.join(sorted(unknown_keys))}")

        for key, param_value in value.items():
            if not math.isfinite(param_value):
                raise ValueError(f"GMPE parameter '{key}' must be finite")
            if abs(param_value) > MAX_ABS_GMPE_PARAM:
                raise ValueError(
                    f"GMPE parameter '{key}' must be between "
                    f"{-MAX_ABS_GMPE_PARAM:g} and {MAX_ABS_GMPE_PARAM:g}"
                )

        return value
