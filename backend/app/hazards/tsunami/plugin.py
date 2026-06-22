from __future__ import annotations

from app.hazards.base.interfaces import HazardPlugin
from app.hazards.base.registry import hazard_registry
from app.hazards.tsunami.router import router
from app.hazards.tsunami.service import tsunami_service


class TsunamiPlugin(HazardPlugin):
    def __init__(self) -> None:
        super().__init__(
            hazard_type="tsunami",
            router=router,
            service=tsunami_service,
            metadata={
                "label": "Tsunami",
                "description": "Empirical tsunami hazard estimates.",
            },
        )


def register() -> None:
    if hazard_registry.get("tsunami") is not None:
        return
    hazard_registry.register(TsunamiPlugin())
