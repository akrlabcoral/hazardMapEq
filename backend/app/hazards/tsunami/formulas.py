"""Empirical tsunami formulas.

These are simplified educational estimates and are not suitable for official
warning or emergency decision-making.
"""
from __future__ import annotations

import math

GRAVITY_MPS2 = 9.81


def validate_non_negative(value: float, name: str) -> float:
    if value < 0:
        raise ValueError(f"{name} must be greater than or equal to 0")
    return value


def validate_positive(value: float, name: str) -> float:
    if value <= 0:
        raise ValueError(f"{name} must be greater than 0")
    return value


def tsunami_velocity_mps(depth_m: float) -> float:
    validate_non_negative(depth_m, "depth_m")
    return math.sqrt(GRAVITY_MPS2 * depth_m)


def tsunami_wavelength_m(period_s: float, depth_m: float) -> float:
    validate_non_negative(period_s, "period_s")
    return period_s * tsunami_velocity_mps(depth_m)


def initial_wave_height_m(seabed_displacement_m: float) -> float:
    validate_non_negative(seabed_displacement_m, "seabed_displacement_m")
    return seabed_displacement_m / 2


def abe_tsunami_magnitude(wave_height_m: float, distance_km: float) -> float:
    validate_positive(wave_height_m, "wave_height_m")
    validate_positive(distance_km, "distance_km")
    return math.log10(wave_height_m) + math.log10(distance_km) + 5.80


def runup_height_m(offshore_height_m: float, amplification_factor: float = 3) -> float:
    validate_non_negative(offshore_height_m, "offshore_height_m")
    validate_non_negative(amplification_factor, "amplification_factor")
    return amplification_factor * offshore_height_m


def classify_tsunami_potential(magnitude: float) -> dict[str, str]:
    validate_non_negative(magnitude, "magnitude")
    if magnitude < 6.5:
        return {"level": "Very Low", "description": "Usually no tsunami"}
    if magnitude < 7.0:
        return {"level": "Low", "description": "Small local tsunami possible"}
    if magnitude < 7.5:
        return {"level": "Moderate", "description": "Local tsunami possible"}
    if magnitude <= 8.0:
        return {"level": "High", "description": "Large tsunami possible"}
    return {"level": "Very High", "description": "Major destructive tsunami possible"}

