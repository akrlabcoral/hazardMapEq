from __future__ import annotations

from fastapi import APIRouter

from app.hazards.tsunami.schemas import TsunamiCalculationRequest, TsunamiCalculationResponse
from app.hazards.tsunami.service import tsunami_service

router = APIRouter()


@router.post("/calculate", response_model=TsunamiCalculationResponse)
def calculate_tsunami(request: TsunamiCalculationRequest) -> TsunamiCalculationResponse:
    return tsunami_service.calculate(request)

