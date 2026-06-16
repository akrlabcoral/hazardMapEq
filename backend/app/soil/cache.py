"""
app/soil/cache.py

Raster handle registry.  Each state raster is opened ONCE at startup
and stored here.  All simulation loops read from these handles — no
raster is ever reopened inside a hot path.
"""
from collections import namedtuple
import logging
import rasterio

logger = logging.getLogger("hazardmap.soil.cache")

BoundingBox = namedtuple("BoundingBox", ["left", "bottom", "right", "top"])

_PATHS: dict[str, str] = {}
_DATASETS: dict[str, rasterio.io.DatasetReader] = {}
_BOUNDS: dict[str, BoundingBox] = {}


def register(state_name: str, path: str) -> None:
    """
    Open and register a raster for the given state name.
    Skips silently if already registered.
    """
    if state_name in _DATASETS:
        return
    try:
        src = rasterio.open(path)
        b = src.bounds
        _BOUNDS[state_name] = BoundingBox(b.left, b.bottom, b.right, b.top)
        _PATHS[state_name] = path
        _DATASETS[state_name] = src
    except Exception as e:
        logger.warning("[SoilCache] Could not open raster for '%s': %s", state_name, e)



def sample_points(state_name: str, coords: list[tuple[float, float]]) -> list:
    dataset = _DATASETS.get(state_name)
    if dataset is None:
        return []
    return list(dataset.sample(coords))


def get_bounds_registry() -> dict[str, BoundingBox]:
    """Returns a copy of the bounds registry for spatial lookup."""
    return dict(_BOUNDS)


def get_all_states() -> list[str]:
    return list(_PATHS.keys())


def close_all() -> None:
    """Close all cached raster handles and clear registries."""
    for src in _DATASETS.values():
        try:
            src.close()
        except Exception:
            pass
    _DATASETS.clear()
    _PATHS.clear()
    _BOUNDS.clear()
    logger.info("[SoilCache] Cache cleared.")
