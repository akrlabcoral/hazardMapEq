"""
app/soil/amplification.py

Converts NEHRP Site Classes (A-E) into normalized seismic amplification
factors.

Interpretation:
  - Higher factor = stronger wave amplification (softer soil)
  - Lower factor  = more attenuating (dense rock)
  - 1.0           = neutral / base rock (Site Class B)
"""
import numpy as np

# Configurable NEHRP Site Class → seismic amplification factor table
SITE_CLASS_AMPLIFICATION_FACTORS: dict[str, float] = {
    "A": 0.8,  # Hard Rock — De-amplification
    "B": 1.0,  # Rock — Neutral / Reference
    "C": 1.2,  # Dense Soil / Soft Rock
    "D": 1.5,  # Stiff Soil
    "E": 2.0,  # Soft Clay Soil — Highest amplification
}

DEFAULT_FACTOR: float = 1.0


def get_amplification_factor(site_class: str) -> float:
    """Return the seismic amplification factor for a given NEHRP Site Class."""
    return SITE_CLASS_AMPLIFICATION_FACTORS.get(site_class, DEFAULT_FACTOR)


def get_amplification_batch(site_classes: list[str]) -> np.ndarray:
    """
    Vectorized version — accepts a list of site classes.
    Returns a float32 NumPy array of amplification factors.
    """
    return np.array(
        [get_amplification_factor(cls) for cls in site_classes],
        dtype=np.float32
    )
