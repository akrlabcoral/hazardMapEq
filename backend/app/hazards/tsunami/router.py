from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.core.errors import NotFoundError, ServiceUnavailableError, ValidationError
from app.hazards.tsunami.schemas import (
    TsunamiAnalysisAcceptedResponse,
    TsunamiAnalysisLayersResponse,
    TsunamiAnalysisRequest,
    TsunamiAnalysisResultResponse,
    TsunamiCalculationRequest,
    TsunamiCalculationResponse,
    TsunamiDamageAssessmentRequest,
    TsunamiDamageAssessmentResponse,
    TsunamiInundationRequest,
    TsunamiInundationResponse,
    TsunamiSourceModelRequest,
    TsunamiSourceModelResponse,
    TsunamiWavePropagationRequest,
    TsunamiWavePropagationResponse,
)
from app.hazards.tsunami.service import tsunami_service

router = APIRouter()


@router.post("/analyze", response_model=TsunamiAnalysisAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def analyze_tsunami(request: TsunamiAnalysisRequest) -> TsunamiAnalysisAcceptedResponse:
    try:
        request_id = await tsunami_service.enqueue_analysis(request)
    except ServiceUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return TsunamiAnalysisAcceptedResponse(
        status="accepted",
        request_id=request_id,
        message="Tsunami analysis queued. Poll /api/hazards/tsunami/result/{request_id}.",
    )


@router.get("/result/{request_id}", response_model=TsunamiAnalysisResultResponse)
async def get_tsunami_analysis_result(request_id: str) -> TsunamiAnalysisResultResponse:
    try:
        return TsunamiAnalysisResultResponse.model_validate(await tsunami_service.get_analysis_result(request_id))
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/layers/{request_id}", response_model=TsunamiAnalysisLayersResponse)
async def get_tsunami_analysis_layers(request_id: str) -> TsunamiAnalysisLayersResponse:
    try:
        return TsunamiAnalysisLayersResponse.model_validate(await tsunami_service.get_analysis_layers(request_id))
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/calculate", response_model=TsunamiCalculationResponse)
def calculate_tsunami(request: TsunamiCalculationRequest) -> TsunamiCalculationResponse:
    return tsunami_service.calculate(request)


@router.post("/source-model", response_model=TsunamiSourceModelResponse)
def model_tsunami_source(request: TsunamiSourceModelRequest) -> TsunamiSourceModelResponse:
    return tsunami_service.model_source(request)


@router.post("/wave-propagation", response_model=TsunamiWavePropagationResponse)
def propagate_tsunami_wave(request: TsunamiWavePropagationRequest) -> TsunamiWavePropagationResponse:
    return tsunami_service.propagate_wave(request)


@router.post("/inundation", response_model=TsunamiInundationResponse)
def model_tsunami_inundation(request: TsunamiInundationRequest) -> TsunamiInundationResponse:
    return tsunami_service.model_inundation(request)


@router.post("/damage-assessment", response_model=TsunamiDamageAssessmentResponse)
def assess_tsunami_damage(request: TsunamiDamageAssessmentRequest) -> TsunamiDamageAssessmentResponse:
    return tsunami_service.assess_damage(request)
