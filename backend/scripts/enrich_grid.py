import geopandas as gpd
import json

print("Loading grid...")
grid = gpd.read_file('data/grids/nationwide_20km.geojson')
print(f"Grid size: {len(grid)}")

print("Loading states...")
states = gpd.read_file('../frontend/public/data/india_states.geojson')

# Ensure CRS match
states = states.to_crs(grid.crs)

print("Spatial joining...")
# We want to assign the 'state' property from states to grid points based on centroid
# The grid features are Polygons. We can use their centroids.
grid['geometry_centroid'] = grid.centroid
grid_pts = grid.copy()
grid_pts['geometry'] = grid_pts['geometry_centroid']

joined = gpd.sjoin(grid_pts, states, how='left', predicate='intersects')

grid['state'] = joined['state']
grid['state'] = grid['state'].fillna('Unknown')

# Drop temp col
grid = grid.drop(columns=['geometry_centroid'])

out_path = 'data/grids/nationwide_20km_enriched.geojson'
grid.to_file(out_path, driver='GeoJSON')
print(f"Saved enriched grid to {out_path}")
