"""Generic interfaces for hazard modules.

These contracts avoid earthquake-specific fields so future hazards can define
their own schemas and calculators without inheriting PGA/MMI assumptions.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, ClassVar, Generic, TypeVar

EventT = TypeVar("EventT")
ResultT = TypeVar("ResultT")


class HazardRepository(ABC, Generic[EventT]):
    @abstractmethod
    def get_event(self, event_id: str | int) -> EventT | None:
        """Return one hazard event or None."""


class HazardCalculator(ABC, Generic[EventT, ResultT]):
    @abstractmethod
    def calculate(self, event: EventT, **kwargs: Any) -> ResultT:
        """Calculate hazard-specific impact output."""


class HazardService(ABC):
    hazard_type: ClassVar[str]

    @abstractmethod
    def validate_input(self, input_data: Any) -> Any:
        """Validate and normalize hazard-specific input."""

    @abstractmethod
    def run_analysis(self, validated_data: Any, **kwargs: Any) -> Any:
        """Run the hazard-specific analysis workflow."""

    def generate_layers(self, result: Any) -> dict[str, Any]:
        """Return optional map layer payloads for an analysis result."""
        return {}

    def generate_report(self, result: Any) -> dict[str, Any]:
        """Return optional report data for an analysis result."""
        return {}

    @abstractmethod
    def serialize_result(self, result: Any) -> dict[str, Any]:
        """Serialize a hazard result to a public API-safe dictionary."""


@dataclass(frozen=True)
class HazardPlugin:
    hazard_type: str
    router: Any
    service: HazardService
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        key = self.hazard_type.strip().lower()
        if not key:
            raise ValueError("hazard_type is required")
        object.__setattr__(self, "hazard_type", key)
