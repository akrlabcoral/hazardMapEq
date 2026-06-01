import numpy as np
import pandas as pd
from app.preprocessing.features import add_physics_features, EARTH_RADIUS_KM

def vectorized_destination_point(source_lat: float, source_lon: float, distance_km: np.ndarray, bearing_deg: np.ndarray):
    """
    Vectorized Haversine destination point calculation.
    """
    lat1 = np.radians(source_lat)
    lon1 = np.radians(source_lon)
    bearing = np.radians(bearing_deg)
    
    angular_distance = distance_km / EARTH_RADIUS_KM
    
    lat2 = np.arcsin(
        np.sin(lat1) * np.cos(angular_distance) +
        np.cos(lat1) * np.sin(angular_distance) * np.cos(bearing)
    )
    
    lon2 = lon1 + np.arctan2(
        np.sin(bearing) * np.sin(angular_distance) * np.cos(lat1),
        np.cos(angular_distance) - np.sin(lat1) * np.sin(lat2)
    )
    
    return np.degrees(lat2), np.degrees(lon2)

def vectorized_xy_to_distance_bearing(x_km: np.ndarray, y_km: np.ndarray):
    """
    Vectorized conversion from cartesian offsets to distance and bearing.
    """
    distance_km = np.sqrt(x_km**2 + y_km**2)
    
    # bearing convention: 0 = North, 90 = East, 180 = South, 270 = West
    bearing_rad = np.arctan2(x_km, y_km)
    bearing_deg = np.degrees(bearing_rad)
    bearing_deg = (bearing_deg + 360) % 360
    
    return distance_km, bearing_deg

def generate_prediction_grid(source_lat: float, source_lon: float, magnitude: float, depth: float, max_radius_km: float, grid_step_km: float = 2.0) -> pd.DataFrame:
    """
    Generates a vectorized prediction grid, removing slow nested loops.
    """
    # Create 1D coordinate arrays
    xy_range = np.arange(-max_radius_km, max_radius_km + grid_step_km, grid_step_km)
    
    # Generate 2D meshgrid
    X, Y = np.meshgrid(xy_range, xy_range)
    
    # Flatten arrays
    x_km = X.flatten()
    y_km = Y.flatten()
    
    # Compute distance and bearing
    distance_km, bearing_deg = vectorized_xy_to_distance_bearing(x_km, y_km)
    
    # Filter points outside max_radius_km
    mask = distance_km <= max_radius_km
    x_km = x_km[mask]
    y_km = y_km[mask]
    distance_km = distance_km[mask]
    bearing_deg = bearing_deg[mask]
    
    # Calculate target points
    point_lat, point_lon = vectorized_destination_point(source_lat, source_lon, distance_km, bearing_deg)
    
    # Set exact source points for distance=0
    zero_mask = distance_km == 0
    point_lat[zero_mask] = source_lat
    point_lon[zero_mask] = source_lon
    
    # Build dataframe
    df = pd.DataFrame({
        "source_lon": source_lon,
        "source_lat": source_lat,
        "point_lat": point_lat,
        "point_lon": point_lon,
        "x_km": x_km,
        "y_km": y_km,
        "distance from source": distance_km,
        "bearing_deg": bearing_deg,
        "source_magnitude": magnitude,
        "source_depth": depth
    })
    
    # Add physics features
    df = add_physics_features(df)
    
    return df
