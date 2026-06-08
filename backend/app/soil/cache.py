"""
app/soil/cache.py

Raster handle registry.  Each state raster is opened ONCE at startup
and stored here.  All simulation loops read from these handles — no
raster is ever reopened inside a hot path.
"""
import logging
import rasterio
from collections import namedtuple

logger = logging.getLogger("hazardmap.soil.cache")

BoundingBox = namedtuple("BoundingBox", ["left", "bottom", "right", "top"])

# Internal registries
_REGISTRY: dict[str, str] = {}
_BOUNDS:   dict[str, BoundingBox] = {}


def register(state_name: str, path: str) -> None:
    """
    Open and register a raster for the given state name.
    Skips silently if already registered.
    """
    if state_name in _REGISTRY:
        return
    try:
        with rasterio.open(path) as src:
            b = src.bounds
            _BOUNDS[state_name] = BoundingBox(b.left, b.bottom, b.right, b.top)
        _REGISTRY[state_name] = path
    except Exception as e:
        logger.warning("[SoilCache] Could not open raster for '%s': %s", state_name, e)


def get_path(state_name: str) -> str | None:
    return _REGISTRY.get(state_name)


def get_bounds_registry() -> dict[str, BoundingBox]:
    """Returns a copy of the bounds registry for spatial lookup."""
    return dict(_BOUNDS)


def get_all_states() -> list[str]:
    return list(_REGISTRY.keys())


def close_all() -> None:
    """Clear registry (no open handles anymore)."""
    _REGISTRY.clear()
    _BOUNDS.clear()
    logger.info("[SoilCache] Cache cleared.")
