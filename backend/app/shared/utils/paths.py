"""Path helpers for backend modules."""
from __future__ import annotations

from pathlib import Path


def backend_root() -> Path:
    return Path(__file__).resolve().parents[3]


def data_path(*parts: str) -> Path:
    return backend_root() / "data" / Path(*parts)

