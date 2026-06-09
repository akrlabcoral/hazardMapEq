from __future__ import annotations

import argparse
import json
import time

from common import DATA_DIR, add_overwrite, ensure_can_write, path_arg


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a nationwide rectangular grid clipped by centroid.")
    parser.add_argument("--boundary", type=path_arg, default=DATA_DIR / "india" / "india_boundary.geojson")
    parser.add_argument("--output", type=path_arg, default=DATA_DIR / "grids" / "nationwide_20km.geojson")
    parser.add_argument("--step", type=float, default=0.18, help="Grid step in degrees.")
    add_overwrite(parser)
    return parser.parse_args()


def _extract_polygons(boundary: dict) -> list:
    polygons = []
    for feature in boundary["features"]:
        geom = feature["geometry"]
        if geom["type"] == "Polygon":
            polygons.append(geom["coordinates"][0])
        elif geom["type"] == "MultiPolygon":
            polygons.extend(poly[0] for poly in geom["coordinates"])
    return polygons


def _point_in_polygon(x: float, y: float, poly: list) -> bool:
    inside = False
    p1x, p1y = poly[0][0], poly[0][1]
    for i in range(1, len(poly) + 1):
        p2x, p2y = poly[i % len(poly)][0], poly[i % len(poly)][1]
        if y > min(p1y, p2y) and y <= max(p1y, p2y) and x <= max(p1x, p2x):
            xints = x
            if p1y != p2y:
                xints = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
            if p1x == p2x or x <= xints:
                inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def generate_grid(boundary_path, output_path, step: float = 0.18, overwrite: bool = False) -> None:
    ensure_can_write(output_path, overwrite)
    start = time.time()
    with open(boundary_path, "r") as f:
        boundary = json.load(f)

    polygons = _extract_polygons(boundary)
    minx = min(pt[0] for poly in polygons for pt in poly)
    maxx = max(pt[0] for poly in polygons for pt in poly)
    miny = min(pt[1] for poly in polygons for pt in poly)
    maxy = max(pt[1] for poly in polygons for pt in poly)
    print(f"Bounding box: {minx:.2f}, {miny:.2f} to {maxx:.2f}, {maxy:.2f}")

    grid_features = []
    x = minx
    cell_id = 0
    while x < maxx:
        y = miny
        while y < maxy:
            cx, cy = x + step / 2, y + step / 2
            if any(_point_in_polygon(cx, cy, poly) for poly in polygons):
                grid_features.append({
                    "type": "Feature",
                    "properties": {"cell_id": f"cell_{cell_id}", "centroid_lon": cx, "centroid_lat": cy},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[x, y], [x + step, y], [x + step, y + step], [x, y + step], [x, y]]],
                    },
                })
                cell_id += 1
            y += step
        x += step

    with open(output_path, "w") as f:
        json.dump({"type": "FeatureCollection", "features": grid_features}, f)
    print(f"Generated {len(grid_features)} cells in {time.time() - start:.2f} seconds.")


if __name__ == "__main__":
    args = parse_args()
    generate_grid(args.boundary, args.output, args.step, args.overwrite)
