from __future__ import annotations

from typing import Any

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


class TsunamiSourceModelRequest(BaseModel):
    magnitude: float = Field(..., ge=0)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    strike_deg: float = Field(default=0)
    dip_deg: float = Field(default=15, gt=0, le=90)
    rake_deg: float = Field(default=90)
    mechanism: str = Field(default="thrust")
    depth_km: float = Field(default=10, ge=0)
    length_km: float | None = Field(default=None, gt=0)
    width_km: float | None = Field(default=None, gt=0)
    slip_m: float | None = Field(default=None, gt=0)


class TsunamiSourceModelResponse(BaseModel):
    rupture_area_km2: float
    rupture_length_km: float
    rupture_width_km: float
    slip_m: float
    rupture_polygon: dict
    vertical_deformation: dict
    metadata: dict
    inputs: TsunamiSourceModelRequest


class TsunamiWavePropagationRequest(BaseModel):
    source_latitude: float = Field(..., ge=-90, le=90)
    source_longitude: float = Field(..., ge=-180, le=180)
    offshore_wave_height_m: float | None = Field(default=None, ge=0)
    magnitude: float | None = Field(default=None, ge=0)
    max_targets: int = Field(default=100, gt=0, le=1000)
    target_spacing_km: float = Field(default=50, gt=0)
    coastal_depth_m: float = Field(default=10, gt=0)
    amplification_factor: float = Field(default=1.5, gt=0)

    @model_validator(mode="after")
    def require_height_source(self):
        if self.offshore_wave_height_m is None and self.magnitude is None:
            raise ValueError("offshore_wave_height_m or magnitude is required")
        return self


class TsunamiWaveTargetResult(BaseModel):
    target: dict
    admin_metadata: dict
    distance_km: float
    eta_minutes: float
    wave_speed_mps: float
    wave_speed_kmh: float
    coastal_wave_height_m: float


class TsunamiWavePropagationResponse(BaseModel):
    is_available: bool
    source: dict
    targets: list[TsunamiWaveTargetResult]
    metadata: dict
    inputs: TsunamiWavePropagationRequest


class TsunamiInundationRequest(BaseModel):
    wave_height_m: float = Field(..., ge=0)
    source_latitude: float | None = Field(default=None, ge=-90, le=90)
    source_longitude: float | None = Field(default=None, ge=-180, le=180)
    max_coast_points: int = Field(default=50, gt=0, le=1000)
    coast_spacing_km: float = Field(default=25, gt=0)
    transect_length_km: float = Field(default=10, gt=0)
    transect_spacing_m: float = Field(default=250, gt=0)
    beach_slope: float | None = Field(default=None, gt=0)


class TsunamiInundationResponse(BaseModel):
    is_available: bool
    runup_height_m: float | None
    max_flood_depth_m: float | None
    inundation_distance_m: float | None
    flood_extent_polygon: dict | None
    flood_depth_points: dict
    metadata: dict
    inputs: TsunamiInundationRequest


class TsunamiDamageAssessmentRequest(BaseModel):
    flood_extent_polygon: dict | None
    flood_depth_points: dict
    runup_height_m: float | None = Field(default=None, ge=0)
    max_flood_depth_m: float | None = Field(default=None, ge=0)
    inundation_distance_m: float | None = Field(default=None, ge=0)


class TsunamiDamageAssessmentResponse(BaseModel):
    is_available: bool
    affected_population: int
    building_damage: dict
    economic_loss: dict
    casualty_estimate: dict
    critical_infrastructure_exposure: dict
    metadata: dict
    inputs: TsunamiDamageAssessmentRequest


class TsunamiAnalysisRequest(BaseModel):
    source_model: TsunamiSourceModelRequest
    wave_propagation: TsunamiWavePropagationRequest | None = None
    inundation: TsunamiInundationRequest | None = None
    include_damage_assessment: bool = True


class TsunamiAnalysisAcceptedResponse(BaseModel):
    status: str
    request_id: str
    message: str


class TsunamiAnalysisResultResponse(BaseModel):
    request_id: str
    status: str
    result_json: dict | None = None
    error: str | None = None
    created_at: Any | None = None
    updated_at: Any | None = None


class TsunamiAnalysisLayersResponse(BaseModel):
    request_id: str
    status: str
    layers: dict
    metadata: dict
