"""Legacy earthquake route exports.

The actual legacy path mounting still lives under ``app.api`` to preserve old
imports. This module exists so the earthquake package owns the route behavior.
"""
from __future__ import annotations

from app.hazards.earthquake.router import router

__all__ = ["router"]

