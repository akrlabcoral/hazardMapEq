import json
import time

def generate_grid():
    start = time.time()
    print("Loading India boundary...")
    with open('backend/data/india/india_boundary.geojson', 'r') as f:
        boundary = json.load(f)
    
    # Extract all exterior polygons
    polygons = []
    def extract_polys(coords, geom_type):
        if geom_type == 'Polygon':
            polygons.append(coords[0]) 
        elif geom_type == 'MultiPolygon':
            for poly in coords:
                polygons.append(poly[0])
                
    for feature in boundary['features']:
        extract_polys(feature['geometry']['coordinates'], feature['geometry']['type'])
        
    # Get bounding box
    minx, miny, maxx, maxy = 180, 90, -180, -90
    for p in polygons:
        for pt in p:
            x, y = pt[0], pt[1]
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y
            
    print(f"Bounding box: {minx:.2f}, {miny:.2f} to {maxx:.2f}, {maxy:.2f}")
    
    # 20km is approximately 0.18 degrees near the equator
    step = 0.18
    
    # Ray-casting algorithm for Point in Polygon
    def point_in_polygon(x, y, poly):
        n = len(poly)
        inside = False
        p1x, p1y = poly[0][0], poly[0][1]
        for i in range(1, n + 1):
            p2x, p2y = poly[i % n][0], poly[i % n][1]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xints = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xints:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    def point_in_any_polygon(x, y):
        for p in polygons:
            if point_in_polygon(x, y, p):
                return True
        return False
        
    print(f"Generating 20x20km grid and intersecting via ray-casting...")
    grid_features = []
    
    x = minx
    cell_id = 0
    while x < maxx:
        y = miny
        while y < maxy:
            cx, cy = x + step/2, y + step/2
            if point_in_any_polygon(cx, cy):
                grid_features.append({
                    "type": "Feature",
                    "properties": {
                        "cell_id": f"cell_{cell_id}",
                        "centroid_lon": cx,
                        "centroid_lat": cy
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[x, y], [x+step, y], [x+step, y+step], [x, y+step], [x, y]]]
                    }
                })
                cell_id += 1
            y += step
        x += step
        
    output = {
        "type": "FeatureCollection",
        "features": grid_features
    }
    
    out_path = 'backend/data/grids/nationwide_20km.geojson'
    with open(out_path, 'w') as f:
        json.dump(output, f)
        
    print(f"Successfully generated {len(grid_features)} cells inside India in {time.time() - start:.2f} seconds.")

if __name__ == '__main__':
    generate_grid()
