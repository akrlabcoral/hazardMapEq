from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class EvacuationRouteRequest(BaseModel):
    source: Coordinate
    destination: Coordinate
    costing: Literal["auto", "pedestrian", "bicycle"] = "auto"
    alternatives: int = Field(default=2, ge=0, le=3)


class NearestHospitalRequest(BaseModel):
    origin: Coordinate
    costing: Literal["auto", "pedestrian", "bicycle"] = "auto"
    hospital_type: Literal["govt", "private", "any"] = "any"
    search_radius_km: float = Field(default=75, gt=0, le=300)


class EvacuationPlanRequest(BaseModel):
    responder_origin: Coordinate
    vulnerable_zone: Coordinate
    costing: Literal["auto", "pedestrian", "bicycle"] = "auto"
    hospital_type: Literal["govt", "private", "any"] = "any"
    search_radius_km: float = Field(default=75, gt=0, le=300)


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


class EvacuationPlanResponse(BaseModel):
    responder_route: RouteResponse
    hospital_route: NearestHospitalResponse
    vulnerable_zone: Coordinate
    responder_origin: Coordinate

