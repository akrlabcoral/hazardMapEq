import numpy as np

EARTH_RADIUS_KM = 6371.0

def calculate_haversine_distance(lat1: float, lon1: float, lats2: np.ndarray, lons2: np.ndarray) -> np.ndarray:
    """
    Vectorized Haversine distance calculation between a single source point and an array of target points.
    Returns distance in km.
    """
    lat1_rad = np.radians(lat1)
    lon1_rad = np.radians(lon1)
    lats2_rad = np.radians(lats2)
    lons2_rad = np.radians(lons2)
    
    dlat = lats2_rad - lat1_rad
    dlon = lons2_rad - lon1_rad
    
    a = np.sin(dlat / 2.0)**2 + np.cos(lat1_rad) * np.cos(lats2_rad) * np.sin(dlon / 2.0)**2
    c = 2 * np.arcsin(np.sqrt(a))
    
    return EARTH_RADIUS_KM * c

def calculate_hypocentral_distance(surface_distance: np.ndarray, depth: float) -> np.ndarray:
    """
    R = sqrt(d^2 + h^2)
    """
    return np.sqrt(surface_distance**2 + depth**2)
