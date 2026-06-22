"""
app/soil/cache.py

Compatibility registry for Vs30 raster handles. The actual raster handle
management lives in app.shared.gis.raster_loader.
"""
import logging

from app.shared.gis.raster_loader import BoundingBox, LazyRasterResource

logger = logging.getLogger("hazardmap.soil.cache")

_PATHS: dict[str, str] = {}
_RASTERS: dict[str, LazyRasterResource] = {}


def register(state_name: str, path: str) -> None:
    """
    Open and register a raster for the given state name.
    Skips silently if already registered.
    """
    if state_name in _RASTERS:
        return
    resource = LazyRasterResource(f"soil:{state_name}", path, default_value=None)
    if not resource.preload():
        logger.warning("[SoilCache] Could not open raster for '%s': %s", state_name, path)
        return
    _PATHS[state_name] = path
    _RASTERS[state_name] = resource


def sample_points(state_name: str, coords: list[tuple[float, float]]) -> list:
    resource = _RASTERS.get(state_name)
    if resource is None:
        return []
    return resource.sample_points(coords)


def get_bounds_registry() -> dict[str, BoundingBox]:
    """Returns a copy of the bounds registry for spatial lookup."""
    registry: dict[str, BoundingBox] = {}
    for state_name, resource in _RASTERS.items():
        bounds = resource.bounds()
        if bounds is not None:
            registry[state_name] = bounds
    return registry


def get_all_states() -> list[str]:
    return list(_PATHS.keys())


def close_all() -> None:
    """Close all cached raster handles and clear registries."""
    for resource in _RASTERS.values():
        resource.close()
    _RASTERS.clear()
    _PATHS.clear()
    logger.info("[SoilCache] Cache cleared.")
