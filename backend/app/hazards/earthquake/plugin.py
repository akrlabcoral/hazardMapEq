"""Earthquake hazard plugin registration."""
from __future__ import annotations

from app.hazards.base.interfaces import HazardPlugin
from app.hazards.base.registry import hazard_registry
from app.hazards.earthquake.router import router
from app.hazards.earthquake.service import earthquake_service


class EarthquakePlugin(HazardPlugin):
    def __init__(self) -> None:
        super().__init__(
            hazard_type="earthquake",
            router=router,
            service=earthquake_service,
            metadata={
                "label": "Earthquake",
                "description": "Live, historic, and simulated earthquake hazard workflows.",
            },
        )


def register() -> None:
    if hazard_registry.get("earthquake") is not None:
        return
    hazard_registry.register(EarthquakePlugin())
