import json
import numpy as np
import geopandas as gpd
from shapely.geometry import box
import rasterio
import os
import pandas as pd

from app.gis.distance import calculate_haversine_distance, calculate_hypocentral_distance
from app.seismic.gmpe import get_gmpe_model
from app.soil.amplification import apply_soil_amplification
from app.damage.damage import classify_damage

# Paths to data
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'data'))
WB_GEOJSON_PATH = os.path.join(DATA_DIR, 'west_bengal', 'west_bengal_boundary.geojson')
DISTRICTS_GEOJSON_PATH = os.path.join(DATA_DIR, 'districts', 'West_Bengal_District_Boundaries_GeoJSON.geojson')
SOIL_TIFF_PATH = os.path.join(DATA_DIR, 'soil', 'west_bengal_soil_type.tif')

def get_or_generate_wb_grid() -> gpd.GeoDataFrame:
    """
    Generates a 5x5 km grid for West Bengal strictly masked by the GeoJSON boundary.
    Uses gpd.sjoin to assign districts and rasterio to sample soil type.
    """
    wb_boundary = gpd.read_file(WB_GEOJSON_PATH)
    districts = gpd.read_file(DISTRICTS_GEOJSON_PATH)
    
    # Ensure matching CRS
    if districts.crs != wb_boundary.crs:
        districts = districts.to_crs(wb_boundary.crs)
        
    minx, miny, maxx, maxy = wb_boundary.total_bounds
    
    grid_size_deg = 0.045
    lons = np.arange(minx, maxx, grid_size_deg)
    lats = np.arange(miny, maxy, grid_size_deg)
    
    xx, yy = np.meshgrid(lons, lats)
    centroids_lon = xx.flatten()
    centroids_lat = yy.flatten()
    
    points_gdf = gpd.GeoDataFrame({
        "lon": centroids_lon,
        "lat": centroids_lat
    }, geometry=gpd.points_from_xy(centroids_lon, centroids_lat), crs=wb_boundary.crs)
    
    # 1. Spatial Join with Districts to get district name and clip simultaneously
    # 'sjoin' will keep only points that fall inside the district polygons.
    joined_points = gpd.sjoin(points_gdf, districts, how="inner", predicate="intersects")
    # Clean up columns, extracting ADM2_NAME
    joined_points["district"] = joined_points["ADM2_NAME"]
    
    # Retain only necessary columns
    clipped_points = joined_points[["lon", "lat", "district", "geometry"]].copy()
    
    # 2. Sample the Soil Type TIF
    coords = [(row['lon'], row['lat']) for _, row in clipped_points.iterrows()]
    soil_values = []
    
    if os.path.exists(SOIL_TIFF_PATH):
        try:
            with rasterio.open(SOIL_TIFF_PATH) as src:
                for val in src.sample(coords):
                    soil_values.append(val[0])
        except Exception as e:
            print(f"Error sampling TIFF: {e}")
            soil_values = [2] * len(coords)
    else:
        soil_values = [2] * len(coords)
    
    # Map the numerical classes to new soil strings
    def map_soil(val):
        if val == 1: return "Rock"
        elif val == 2: return "Lateritic"
        elif val == 3: return "Alluvial"
        elif val == 4: return "Deltaic"
        elif val == 5: return "Soft sediment"
        return "Alluvial" # Default fallback
    
    clipped_points["soil_type"] = [map_soil(v) for v in soil_values]
    
    # 3. Convert points to 5x5km polygons for visualization
    polygons = [
        box(x - grid_size_deg/2, y - grid_size_deg/2, x + grid_size_deg/2, y + grid_size_deg/2) 
        for x, y in zip(clipped_points['lon'], clipped_points['lat'])
    ]
    clipped_points.geometry = polygons
    
    return clipped_points

try:
    WB_GRID_GDF = get_or_generate_wb_grid()
except Exception as e:
    print(f"Warning: Failed to generate WB Grid on startup. Falling back to empty GeoDataFrame. Error: {e}")
    WB_GRID_GDF = gpd.GeoDataFrame()

def calculate_impacts(lat: float, lon: float, mag: float, depth: float, gmpe_model: str = "indian_shield") -> dict:
    if WB_GRID_GDF.empty:
        return {"grid_geojson": {"type": "FeatureCollection", "features": []}, "district_summary": []}
        
    gdf = WB_GRID_GDF.copy()
    
    surface_dist = calculate_haversine_distance(lat, lon, gdf['lat'].values, gdf['lon'].values)
    hypocentral_dist = calculate_hypocentral_distance(surface_dist, depth)
    
    model = get_gmpe_model(gmpe_model)
    base_pga = model.calculate_pga(mag, hypocentral_dist)
    adjusted_pga = apply_soil_amplification(base_pga, gdf['soil_type'].values)
    
    # Clamp extreme values to prevent numerical overflow in the frontend (e.g. MapLibre crashes)
    # 5.0g is an extremely conservative upper bound for realistic seismic acceleration
    base_pga = np.nan_to_num(base_pga, nan=0.0, posinf=5.0, neginf=0.0)
    adjusted_pga = np.nan_to_num(adjusted_pga, nan=0.0, posinf=5.0, neginf=0.0)
    base_pga = np.clip(base_pga, 0.0, 5.0)
    adjusted_pga = np.clip(adjusted_pga, 0.0, 5.0)
    
    damage_level = classify_damage(adjusted_pga)
    
    gdf["distance_km"] = np.round(surface_dist, 2)
    gdf["base_pga"] = np.round(base_pga, 4)
    gdf["adjusted_pga"] = np.round(adjusted_pga, 4)
    gdf["damage_level"] = damage_level
    
    # Compute District Summaries
    # Use pandas groupby
    summary = gdf.groupby('district').agg(
        avg_pga=('adjusted_pga', 'mean'),
        max_pga=('adjusted_pga', 'max'),
        severe_cells=('damage_level', lambda x: (x == 'Severe').sum()),
        moderate_cells=('damage_level', lambda x: (x == 'Moderate').sum()),
        total_cells=('damage_level', 'count')
    ).reset_index()
    
    # Round metrics
    summary['avg_pga'] = summary['avg_pga'].round(4)
    summary['max_pga'] = summary['max_pga'].round(4)
    
    # Drop lat/lon helpers to clean up GeoJSON properties
    gdf = gdf.drop(columns=["lat", "lon"])
    grid_geojson = json.loads(gdf.to_json())
    
    return {
        "grid_geojson": grid_geojson,
        "district_summary": summary.to_dict(orient="records")
    }
