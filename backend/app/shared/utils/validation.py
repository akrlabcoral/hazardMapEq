"""Shared validation helpers."""
from __future__ import annotations


def require_finite_number(value: float, name: str) -> float:
    if value != value or value in {float("inf"), float("-inf")}:
        raise ValueError(f"{name} must be a finite number")
    return value

