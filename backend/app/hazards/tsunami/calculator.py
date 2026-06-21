from __future__ import annotations

from app.hazards.tsunami import formulas
from app.hazards.tsunami.schemas import TsunamiCalculationRequest

DISCLAIMER = (
    "This tsunami estimate is based on simplified empirical formulas and "
    "should not be used for official warning or emergency decision-making."
)


def calculate_tsunami_hazard(request: TsunamiCalculationRequest) -> dict:
    speed_mps = formulas.tsunami_velocity_mps(request.depth_m)
    wavelength_m = formulas.tsunami_wavelength_m(request.period_s, request.depth_m)

    initial_height = (
        formulas.initial_wave_height_m(request.seabed_displacement_m)
        if request.seabed_displacement_m is not None
        else None
    )
    abe_magnitude = (
        formulas.abe_tsunami_magnitude(request.wave_height_m, request.distance_km)
        if request.wave_height_m is not None and request.distance_km is not None
        else None
    )
    runup = (
        formulas.runup_height_m(request.wave_height_m, request.amplification_factor)
        if request.wave_height_m is not None
        else None
    )

    return {
        "tsunami_speed_mps": speed_mps,
        "tsunami_speed_kmh": speed_mps * 3.6,
        "wavelength_m": wavelength_m,
        "initial_wave_height_m": initial_height,
        "abe_tsunami_magnitude": abe_magnitude,
        "estimated_runup_m": runup,
        "tsunami_potential_class": formulas.classify_tsunami_potential(request.magnitude),
        "explanation": DISCLAIMER,
        "inputs": request,
    }

