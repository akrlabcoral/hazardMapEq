import os
import geopandas as gpd

DISTRICTS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "india_districts.geojson")
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "india", "india_states.geojson")

def generate_state_boundaries():
    print(f"Loading districts from {DISTRICTS_FILE}...")
    gdf = gpd.read_file(DISTRICTS_FILE)
    
    print("Dissolving districts into states (this will take a moment)...")
    # Dissolve by STATE_UT to create state boundaries
    states_gdf = gdf.dissolve(by="STATE_UT")
    
    # Simplify geometry (0.01 degrees is ~1km) to reduce payload
    print("Simplifying geometries...")
    states_gdf["geometry"] = states_gdf["geometry"].simplify(0.01, preserve_topology=True)
    
    # Clean up properties
    states_gdf = states_gdf.reset_index()
    states_gdf = states_gdf[["STATE_UT", "geometry"]]
    states_gdf = states_gdf.rename(columns={"STATE_UT": "state"})
    
    print(f"Writing {len(states_gdf)} states to {OUTPUT_FILE}...")
    states_gdf.to_file(OUTPUT_FILE, driver="GeoJSON")
    print("Done!")

if __name__ == "__main__":
    generate_state_boundaries()
