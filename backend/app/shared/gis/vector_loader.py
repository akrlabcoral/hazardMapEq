"""Shared vector loading helpers."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import orjson


def load_geojson(path: str | Path) -> dict[str, Any]:
    with Path(path).open("rb") as handle:
        return orjson.loads(handle.read())

