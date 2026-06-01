"""
app/soil/site_class.py

Maps Vs30 (shear-wave velocity in top 30m, in m/s) to NEHRP Site Classes (A-E).
"""
import numpy as np

def get_site_class(vs30: float) -> str:
    """
    Return the NEHRP Site Class for a given Vs30 value.
    
    A: > 1500 m/s (Hard Rock)
    B: 760 - 1500 m/s (Rock)
    C: 360 - 760 m/s (Very Dense Soil and Soft Rock)
    D: 180 - 360 m/s (Stiff Soil)
    E: < 180 m/s (Soft Clay Soil)
    """
    if vs30 > 1500:
        return "A"
    elif vs30 > 760:
        return "B"
    elif vs30 > 360:
        return "C"
    elif vs30 > 180:
        return "D"
    else:
        return "E"

def get_site_classes_batch(vs30_values: np.ndarray) -> list[str]:
    """Vectorized version — accepts a numpy array of Vs30 values."""
    return [get_site_class(float(v)) for v in vs30_values]
