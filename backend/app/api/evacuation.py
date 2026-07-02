from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.core.errors import NotFoundError, ServiceUnavailableError
from app.services.evacuation.route_service import EvacuationRouteService
from app.services.evacuation.schemas import (
    EvacuationPlanRequest,
    EvacuationPlanResponse,
    EvacuationRouteRequest,
    NearestHospitalRequest,
    NearestHospitalResponse,
    RouteResponse,
)

router = APIRouter(prefix="/evacuation", tags=["evacuation"])
service = EvacuationRouteService()


@router.post("/routes", response_model=RouteResponse)
async def evacuation_routes(request: EvacuationRouteRequest) -> RouteResponse:
    try:
        return await service.routes(request)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ServiceUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/nearest-hospital", response_model=NearestHospitalResponse)
async def nearest_hospital(request: NearestHospitalRequest) -> NearestHospitalResponse:
    try:
        return await service.nearest_hospital(request)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ServiceUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/plan", response_model=EvacuationPlanResponse)
async def evacuation_plan(request: EvacuationPlanRequest) -> EvacuationPlanResponse:
    try:
        return await service.plan(request)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ServiceUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
