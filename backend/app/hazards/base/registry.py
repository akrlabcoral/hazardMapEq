"""Central registry for natural hazard plugins."""
from __future__ import annotations

from app.hazards.base.interfaces import HazardPlugin


class HazardRegistry:
    def __init__(self) -> None:
        self._plugins: dict[str, HazardPlugin] = {}

    def register(self, plugin: HazardPlugin) -> None:
        if not isinstance(plugin, HazardPlugin):
            raise TypeError("register() expects a HazardPlugin instance")
        key = plugin.hazard_type
        if key in self._plugins:
            raise ValueError(f"Hazard plugin already registered: {key}")
        self._plugins[key] = plugin

    def get(self, hazard_type: str) -> HazardPlugin | None:
        return self._plugins.get(hazard_type.strip().lower())

    def all(self) -> list[HazardPlugin]:
        return list(self._plugins.values())


hazard_registry = HazardRegistry()
