"""Generic interfaces for hazard modules.

These contracts avoid earthquake-specific fields so future hazards can define
their own schemas and calculators without inheriting PGA/MMI assumptions.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

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
    hazard_type: str

