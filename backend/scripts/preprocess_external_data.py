import json
import os
import glob
import rasterio
from shapely.geometry import shape, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISTRICTS_GEOJSON = os.path.join(BASE_DIR, 'data', 'india_districts.geojson')
GRID_IN = os.path.join(BASE_DIR, 'data', 'grids', 'nationwide_50km.geojson')
GRID_OUT = os.path.join(BASE_DIR, 'data', 'grids', 'nationwide_50km.geojson')  # OVERWRITE IN PLACE
SIMPLIFIED_BOUNDARY = os.path.join(BASE_DIR, 'data', 'india', 'india_boundary.geojson') # OVERWRITE IN PLACE
SOIL_DIR = os.path.join(BASE_DIR, 'data', 'external_soils')

def process_grid():
    print("Loading districts...")
    with open(DISTRICTS_GEOJSON, 'r') as f:
        districts_data = json.load(f)
        
    district_features = districts_data['features']
    geometries = []
    properties_list = []
    
    for feat in district_features:
        geom = shape(feat['geometry'])
        geometries.append(geom)
        properties_list.append(feat['properties'])
        
    print("Building spatial index...")
    tree = STRtree(geometries)

    print("Loading 50km grid...")
    with open(GRID_IN, 'r') as f:
        grid_data = json.load(f)

    # Pre-open all TIFF files in memory
    print("Loading state TIFFs...")
    tiffs = glob.glob(os.path.join(SOIL_DIR, '**', '*.tif'), recursive=True)
    datasets = []
    for t in tiffs:
        try:
            src = rasterio.open(t)
            datasets.append(src)
        except Exception as e:
            print(f"Failed to open {t}: {e}")

    print("Sampling soil values and mapping districts...")
    for feature in grid_data['features']:
        poly = shape(feature['geometry'])
        centroid = poly.centroid
        lon, lat = centroid.x, centroid.y
        
        # Map to district
        idx = tree.query(centroid)
        if isinstance(idx, list) or hasattr(idx, '__len__'):
            idx = idx[0] if len(idx) > 0 else None
        
        if idx is not None:
            dist_props = properties_list[idx]
            feature['properties']['district'] = dist_props.get('DISTRICT', 'Unknown')
            feature['properties']['state'] = dist_props.get('STATE_UT', 'Unknown')
        else:
            feature['properties']['district'] = 'Offshore/Unknown'
            feature['properties']['state'] = 'Offshore/Unknown'
            
        # Sample soil - try datasets until one yields a valid number
        soil_val = 0.5 # Default
        for src in datasets:
            # Check if point is inside bounding box
            bounds = src.bounds
            if bounds.left <= lon <= bounds.right and bounds.bottom <= lat <= bounds.top:
                try:
                    for val in src.sample([(lon, lat)]):
                        v = float(val[0])
                        if v > 0 and v < 5000:  # Valid bounds
                            soil_val = v
                            break
                    if soil_val != 0.5:
                        break # Found valid soil
                except:
                    pass
                    
        feature['properties']['soil_vs30'] = soil_val
                
    print(f"Writing processed grid to {GRID_OUT}...")
    with open(GRID_OUT, 'w') as f:
        json.dump(grid_data, f)
        
    # Close datasets
    for src in datasets:
        src.close()
        
def create_simplified_boundary():
    print("Generating simplified national boundary...")
    with open(DISTRICTS_GEOJSON, 'r') as f:
        districts_data = json.load(f)
        
    geometries = [shape(feat['geometry']) for feat in districts_data['features']]
    print("Dissolving geometries (this may take a minute)...")
    boundary = unary_union(geometries)
    
    print("Simplifying boundary...")
    simplified = boundary.simplify(0.01, preserve_topology=True)
    
    out_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"country": "India"},
                "geometry": simplified.__geo_interface__
            }
        ]
    }
    
    print(f"Writing simplified boundary to {SIMPLIFIED_BOUNDARY}...")
    with open(SIMPLIFIED_BOUNDARY, 'w') as f:
        json.dump(out_geojson, f)

if __name__ == '__main__':
    process_grid()
    create_simplified_boundary()
    print("Done!")
