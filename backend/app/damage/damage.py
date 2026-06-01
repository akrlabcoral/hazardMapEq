import numpy as np

def classify_damage(adjusted_pga: np.ndarray) -> np.ndarray:
    """
    Categorizes the PGA into discrete damage levels.
    """
    conditions = [
        adjusted_pga < 0.02,
        (adjusted_pga >= 0.02) & (adjusted_pga < 0.05),
        (adjusted_pga >= 0.05) & (adjusted_pga < 0.1),
        (adjusted_pga >= 0.1) & (adjusted_pga < 0.2),
        adjusted_pga >= 0.2
    ]
    
    choices = [
        "Negligible",
        "Light",
        "Moderate",
        "Strong",
        "Severe"
    ]
    
    # Use np.select to efficiently apply conditions to the numpy array
    return np.select(conditions, choices, default="Unknown")
