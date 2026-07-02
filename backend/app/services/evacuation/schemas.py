from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class EvacuationRouteRequest(BaseModel):
    source: Coordinate
    destination: Coordinate
    costing: Literal["auto", "pedestrian", "bicycle"] = "auto"
    alternatives: int = Field(default=2, ge=0, le=3)


class UnsafeZone(BaseModel):
    id: str | None = None
    bbox: list[float] | None = Field(default=None, min_length=4, max_length=4)
    geometry: dict[str, Any] | None = None
    risk_category: str | None = None
    pga: float | None = None


class NearestHospitalRequest(BaseModel):
    origin: Coordinate
    costing: Literal["auto", "pedestrian", "bicycle"] = "auto"
    hospital_type: Literal["govt", "private", "any"] = "any"
    search_radius_km: float = Field(default=75, gt=0, le=300)
    unsafe_zones: list[UnsafeZone] = Field(default_factory=list)


class EvacuationPlanRequest(BaseModel):
    responder_origin: Coordinate
    vulnerable_zone: Coordinate
    costing: Literal["auto", "pedestrian", "bicycle"] = "auto"
    hospital_type: Literal["govt", "private", "any"] = "any"
    search_radius_km: float = Field(default=75, gt=0, le=300)
    unsafe_zones: list[UnsafeZone] = Field(default_factory=list)


class AutoEvacuationTarget(BaseModel):
    rank: int = Field(..., ge=1, le=10)
    origin: Coordinate
    pga: float | None = None
    state: str | None = None
    risk_category: str | None = None


class AutoNearestHospitalsRequest(BaseModel):
    targets: list[AutoEvacuationTarget] = Field(..., min_length=1, max_length=10)
    costing: Literal["auto", "pedestrian", "bicycle"] = "auto"
    hospital_type: Literal["govt", "private", "any"] = "any"
    search_radius_km: float = Field(default=75, gt=0, le=300)
    unsafe_zones: list[UnsafeZone] = Field(default_factory=list)


class DirectionStep(BaseModel):
    instruction: str
    road: str
    distance_m: int
    duration_s: int
    type: str
    modifier: str = ""


class RouteSummary(BaseModel):
    route_index: int
    is_best: bool
    distance_km: float
    duration_min: float
    steps: list[DirectionStep] = Field(default_factory=list)


class Hospital(BaseModel):
    name: str
    lat: float
    lon: float
    type: str = "Hospital"


class RouteResponse(BaseModel):
    best_route_index: int
    routes: list[RouteSummary]
    geojson: dict


class NearestHospitalResponse(RouteResponse):
    hospital: Hospital
    hospitals_geojson: dict


class AutoNearestHospitalResult(BaseModel):
    rank: int
    target: AutoEvacuationTarget
    plan: NearestHospitalResponse | None = None
    error: str | None = None


class AutoNearestHospitalsResponse(BaseModel):
    results: list[AutoNearestHospitalResult]


class EvacuationPlanResponse(BaseModel):
    responder_route: RouteResponse
    hospital_route: NearestHospitalResponse
    vulnerable_zone: Coordinate
    responder_origin: Coordinate
