"""Central registry for natural hazard plugins."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter


@dataclass(frozen=True)
class HazardPlugin:
    hazard_type: str
    router: APIRouter
    service: Any
    metadata: dict[str, Any]


class HazardRegistry:
    def __init__(self) -> None:
        self._plugins: dict[str, HazardPlugin] = {}

    def register(
        self,
        *,
        hazard_type: str,
        router: APIRouter,
        service: Any,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        key = hazard_type.strip().lower()
        if not key:
            raise ValueError("hazard_type is required")
        if key in self._plugins:
            raise ValueError(f"Hazard plugin already registered: {key}")
        self._plugins[key] = HazardPlugin(
            hazard_type=key,
            router=router,
            service=service,
            metadata=metadata or {},
        )

    def get(self, hazard_type: str) -> HazardPlugin | None:
        return self._plugins.get(hazard_type.strip().lower())

    def all(self) -> list[HazardPlugin]:
        return list(self._plugins.values())


hazard_registry = HazardRegistry()

