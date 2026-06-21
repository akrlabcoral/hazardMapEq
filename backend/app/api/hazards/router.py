"""Router that exposes registered hazard plugins under /api/hazards."""
from __future__ import annotations

import importlib
import pkgutil

from fastapi import APIRouter

import app.hazards
from app.hazards.base.registry import hazard_registry


def discover_hazard_plugins() -> None:
    for module_info in pkgutil.iter_modules(app.hazards.__path__):
        if module_info.name == "base":
            continue
        plugin_module_name = f"app.hazards.{module_info.name}.plugin"
        try:
            plugin_module = importlib.import_module(plugin_module_name)
        except ModuleNotFoundError as exc:
            if exc.name == plugin_module_name:
                continue
            raise
        register = getattr(plugin_module, "register", None)
        if callable(register):
            register()


def create_hazards_router() -> APIRouter:
    discover_hazard_plugins()

    router = APIRouter(prefix="/hazards", tags=["hazards"])
    for plugin in hazard_registry.all():
        router.include_router(
            plugin.router,
            prefix=f"/{plugin.hazard_type}",
            tags=[f"hazard:{plugin.hazard_type}"],
        )
    return router


router = create_hazards_router()
