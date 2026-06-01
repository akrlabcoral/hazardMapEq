import json
import geopandas as gpd

def main():
    states_path = '../frontend/public/data/india_states.geojson'
    grid_path = 'data/grids/nationwide_20km.geojson'
    
    print("1. Injecting numeric IDs into india_states.geojson...")
    with open(states_path, 'r') as f:
        states_data = json.load(f)
        
    for i, feature in enumerate(states_data['features']):
        # MapLibre feature-state requires a top-level numeric id
        feature['id'] = i + 1
        # Also copy it to properties for easier filtering if needed
        feature['properties']['id'] = i + 1
        
    with open(states_path, 'w') as f:
        json.dump(states_data, f)
    print("   Done.")
    
    print("2. Spatially joining grid with states...")
    states_gdf = gpd.read_file(states_path)
    grid_gdf = gpd.read_file(grid_path)
    
    # Ensure CRS match
    states_gdf = states_gdf.to_crs(grid_gdf.crs)
    
    # Extract centroids to a temporary geometry column
    grid_gdf['geometry_centroid'] = grid_gdf.centroid
    grid_pts = grid_gdf.copy()
    grid_pts.set_geometry('geometry_centroid', inplace=True)
    
    print("   Running sjoin...")
    joined = gpd.sjoin(grid_pts, states_gdf[['state', 'geometry']], how='left', predicate='intersects')
    
    # Map back to original grid properties
    with open(grid_path, 'r') as f:
        grid_data = json.load(f)
        
    state_mapping = joined['state'].fillna('Unknown').tolist()
    
    for i, feature in enumerate(grid_data['features']):
        feature['properties']['state'] = state_mapping[i]
        
    with open(grid_path, 'w') as f:
        json.dump(grid_data, f)
        
    print("   Done.")
    print("Enrichment complete.")

if __name__ == "__main__":
    main()
