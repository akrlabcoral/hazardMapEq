from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class TsunamiCalculationRequest(BaseModel):
    magnitude: float = Field(..., ge=0)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    depth_m: float = Field(default=4000, ge=0)
    period_s: float = Field(default=1200, ge=0)
    seabed_displacement_m: float | None = Field(default=None, ge=0)
    wave_height_m: float | None = Field(default=None, ge=0)
    distance_km: float | None = Field(default=None, ge=0)
    amplification_factor: float = Field(default=3, ge=2, le=10)

    @model_validator(mode="after")
    def require_log_inputs_together(self):
        if self.wave_height_m is not None and self.distance_km is None:
            raise ValueError("distance_km is required when wave_height_m is provided")
        if self.distance_km is not None and self.wave_height_m is None:
            raise ValueError("wave_height_m is required when distance_km is provided")
        if self.wave_height_m == 0:
            raise ValueError("wave_height_m must be greater than 0 when provided")
        if self.distance_km == 0:
            raise ValueError("distance_km must be greater than 0 when provided")
        return self


class TsunamiPotentialClass(BaseModel):
    level: str
    description: str


class TsunamiCalculationResponse(BaseModel):
    tsunami_speed_mps: float
    tsunami_speed_kmh: float
    wavelength_m: float
    initial_wave_height_m: float | None
    abe_tsunami_magnitude: float | None
    estimated_runup_m: float | None
    tsunami_potential_class: TsunamiPotentialClass
    explanation: str
    inputs: TsunamiCalculationRequest

