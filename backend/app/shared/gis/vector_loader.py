"""Shared vector loading helpers."""
from __future__ import annotations

from pathlib import Path
import threading
from typing import Any

import orjson


def load_geojson(path: str | Path) -> dict[str, Any]:
    with Path(path).open("rb") as handle:
        return orjson.loads(handle.read())


class LazyGeoJSONResource:
    """Thread-safe lazy GeoJSON loader."""

    def __init__(self, name: str, path: str | Path | None) -> None:
        self.name = name
        self.path = Path(path) if path else None
        self._lock = threading.RLock()
        self._data: dict[str, Any] | None = None
        self._load_count = 0

    @property
    def load_count(self) -> int:
        return self._load_count

    def is_configured(self) -> bool:
        return self.path is not None

    def is_available(self) -> bool:
        return bool(self.path and self.path.is_file())

    def get_data(self) -> dict[str, Any] | None:
        with self._lock:
            if self._data is not None:
                return self._data
            if not self.is_available():
                return None
            self._data = load_geojson(self.path)
            self._load_count += 1
            return self._data

    def clear_cache(self) -> None:
        with self._lock:
            self._data = None


__all__ = ["LazyGeoJSONResource", "load_geojson"]
