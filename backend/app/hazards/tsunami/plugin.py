from __future__ import annotations

from app.hazards.base.registry import hazard_registry
from app.hazards.tsunami.router import router
from app.hazards.tsunami.service import tsunami_service


def register() -> None:
    if hazard_registry.get("tsunami") is not None:
        return
    hazard_registry.register(
        hazard_type="tsunami",
        router=router,
        service=tsunami_service,
        metadata={
            "label": "Tsunami",
            "description": "Empirical tsunami hazard estimates.",
        },
    )

