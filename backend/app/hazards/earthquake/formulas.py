"""Earthquake formula exports.

Formula implementations stay in their current modules for compatibility. This
module is the hazard-owned import surface for future earthquake code.
"""
from __future__ import annotations

from app.layers.pga.gmpe import GroundMotionModel
from app.layers.pga.regions import TectonicRegion, get_tectonic_region
from app.soil.amplification import soil_factor
from app.soil.site_class import site_class_from_vs30

__all__ = [
    "GroundMotionModel",
    "TectonicRegion",
    "get_tectonic_region",
    "site_class_from_vs30",
    "soil_factor",
]

