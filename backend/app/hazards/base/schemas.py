"""Generic Pydantic schemas shared by hazard APIs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class HazardEventSchema(BaseModel):
    hazard_type: str
    event_id: str
    source: str | None = None
    occurred_at: datetime | None = None
    geometry: dict[str, Any] | None = None
    intensity: float | None = None
    severity: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class HazardImpactResultSchema(BaseModel):
    hazard_type: str
    event_id: str
    exposure: dict[str, Any] = Field(default_factory=dict)
    impact_summary: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

