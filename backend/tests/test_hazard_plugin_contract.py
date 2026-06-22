from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

import pytest
from fastapi import APIRouter

from app.hazards.base.interfaces import HazardPlugin, HazardService
from app.hazards.base.registry import HazardRegistry
from app.main import app


class DummyService(HazardService):
    hazard_type = "dummy"

    def validate_input(self, input_data: Any) -> Any:
        return input_data

    def run_analysis(self, validated_data: Any, **kwargs: Any) -> Any:
        return validated_data

    def serialize_result(self, result: Any) -> dict[str, Any]:
        return {"result": result}


def _dummy_plugin(hazard_type: str = "dummy") -> HazardPlugin:
    return HazardPlugin(
        hazard_type=hazard_type,
        router=APIRouter(),
        service=DummyService(),
        metadata={"label": "Dummy"},
    )


def test_registry_accepts_plugin_objects_and_rejects_duplicates():
    registry = HazardRegistry()
    plugin = _dummy_plugin()

    registry.register(plugin)

    assert registry.get("dummy") is plugin
    assert registry.all() == [plugin]
    with pytest.raises(ValueError, match="already registered"):
        registry.register(_dummy_plugin())
    with pytest.raises(TypeError, match="HazardPlugin"):
        registry.register(object())  # type: ignore[arg-type]


def test_registered_hazards_expose_standard_service_contract():
    from app.hazards.base.registry import hazard_registry

    for hazard_type in ("earthquake", "tsunami"):
        plugin = hazard_registry.get(hazard_type)
        assert plugin is not None
        for method_name in (
            "validate_input",
            "run_analysis",
            "generate_layers",
            "generate_report",
            "serialize_result",
        ):
            assert callable(getattr(plugin.service, method_name))


def test_modular_hazard_routes_remain_registered():
    paths = {getattr(route, "path", "") for route in app.routes}

    assert "/api/hazards/earthquake/events" in paths
    assert "/api/hazards/earthquake/simulate-earthquake" in paths
    assert "/api/hazards/tsunami/calculate" in paths
    assert "/api/events" in paths
    assert "/api/simulate-earthquake" in paths


def test_base_and_shared_modules_do_not_import_concrete_hazards():
    repo_root = Path(__file__).resolve().parents[1]
    checked_roots = [repo_root / "app" / "hazards" / "base", repo_root / "app" / "shared"]
    forbidden = ("app.hazards.earthquake", "app.hazards.tsunami")

    for root in checked_roots:
        for path in root.rglob("*.py"):
            tree = ast.parse(path.read_text(), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    names = [node.module or ""]
                else:
                    continue
                assert not any(name.startswith(forbidden) for name in names), str(path)
