"""Generic hazard data structures."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class HazardEvent:
    hazard_type: str
    event_id: str
    source: str | None = None
    occurred_at: datetime | None = None
    geometry: dict[str, Any] | None = None
    intensity: float | None = None
    severity: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class HazardImpactResult:
    hazard_type: str
    event_id: str
    exposure: dict[str, Any] = field(default_factory=dict)
    impact_summary: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

