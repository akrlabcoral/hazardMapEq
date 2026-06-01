import numpy as np
import pandas as pd

EARTH_RADIUS_KM = 6371.0

def add_physics_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Vectorized calculation of physics-informed features for ML inference.
    Takes a DataFrame containing: 'distance from source', 'source_depth', 'source_magnitude'.
    """
    df = df.copy()
    
    # Clip lower bounds to avoid division by zero or log(0) issues
    d = df["distance from source"].astype(float).clip(lower=0)
    depth = df["source_depth"].astype(float).clip(lower=0)
    mag = df["source_magnitude"].astype(float)
    
    # Calculate physics features
    df["hypocentral_distance"] = np.sqrt(d**2 + depth**2)
    df["log_distance"] = np.log1p(d)
    df["log_hypocentral_distance"] = np.log1p(df["hypocentral_distance"])
    df["inverse_hypocentral_distance"] = 1.0 / (df["hypocentral_distance"] + 1.0)
    df["magnitude_minus_logR"] = mag - np.log10(df["hypocentral_distance"] + 1.0)
    df["mag_by_inverse_R"] = mag / (df["hypocentral_distance"] + 1.0)
    
    return df
