from __future__ import annotations

from app.hazards.base.interfaces import HazardService
from app.hazards.tsunami.calculator import calculate_tsunami_hazard
from app.hazards.tsunami.schemas import TsunamiCalculationRequest, TsunamiCalculationResponse


class TsunamiService(HazardService):
    hazard_type = "tsunami"

    def calculate(self, request: TsunamiCalculationRequest) -> TsunamiCalculationResponse:
        return TsunamiCalculationResponse.model_validate(calculate_tsunami_hazard(request))


tsunami_service = TsunamiService()

