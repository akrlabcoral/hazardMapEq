from __future__ import annotations

import argparse
import glob
import json

import rasterio
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from common import DATA_DIR, add_overwrite, ensure_can_write, path_arg


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich grid with districts/soil and create simplified boundary.")
    parser.add_argument("--districts", type=path_arg, default=DATA_DIR / "india_districts.geojson")
    parser.add_argument("--grid", type=path_arg, default=DATA_DIR / "grids" / "nationwide_50km.geojson")
    parser.add_argument("--grid-output", type=path_arg, default=DATA_DIR / "grids" / "nationwide_50km.geojson")
    parser.add_argument("--boundary-output", type=path_arg, default=DATA_DIR / "india" / "india_boundary.geojson")
    parser.add_argument("--soil-dir", type=path_arg, default=DATA_DIR / "external_soils")
    add_overwrite(parser)
    return parser.parse_args()


def process_grid(districts_path, grid_path, grid_output, soil_dir, overwrite: bool = False) -> None:
    if grid_output == grid_path and not overwrite:
        raise SystemExit("Refusing to overwrite grid in place. Pass --overwrite.")
    if grid_output != grid_path:
        ensure_can_write(grid_output, overwrite)

    with open(districts_path, "r") as f:
        districts_data = json.load(f)

    geometries = [shape(feat["geometry"]) for feat in districts_data["features"]]
    properties_list = [feat["properties"] for feat in districts_data["features"]]
    tree = STRtree(geometries)

    with open(grid_path, "r") as f:
        grid_data = json.load(f)

    datasets = []
    for tif in sorted(glob.glob(str(soil_dir / "**" / "*.tif"), recursive=True)):
        try:
            datasets.append(rasterio.open(tif))
        except Exception as exc:
            print(f"Failed to open {tif}: {exc}")

    try:
        for feature in grid_data["features"]:
            centroid = shape(feature["geometry"]).centroid
            lon, lat = centroid.x, centroid.y

            idx = tree.query(centroid)
            idx = idx[0] if hasattr(idx, "__len__") and len(idx) > 0 else None
            if idx is not None:
                dist_props = properties_list[idx]
                feature["properties"]["district"] = dist_props.get("DISTRICT", "Unknown")
                feature["properties"]["state"] = dist_props.get("STATE_UT", "Unknown")
            else:
                feature["properties"]["district"] = "Offshore/Unknown"
                feature["properties"]["state"] = "Offshore/Unknown"

            feature["properties"]["soil_vs30"] = _sample_soil(datasets, lon, lat)

        with open(grid_output, "w") as f:
            json.dump(grid_data, f)
    finally:
        for src in datasets:
            src.close()


def create_simplified_boundary(districts_path, boundary_output, overwrite: bool = False) -> None:
    ensure_can_write(boundary_output, overwrite)
    with open(districts_path, "r") as f:
        districts_data = json.load(f)
    geometries = [shape(feat["geometry"]) for feat in districts_data["features"]]
    simplified = unary_union(geometries).simplify(0.01, preserve_topology=True)
    out_geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"country": "India"},
            "geometry": simplified.__geo_interface__,
        }],
    }
    with open(boundary_output, "w") as f:
        json.dump(out_geojson, f)


def _sample_soil(datasets, lon: float, lat: float) -> float:
    for src in datasets:
        bounds = src.bounds
        if not (bounds.left <= lon <= bounds.right and bounds.bottom <= lat <= bounds.top):
            continue
        try:
            for val in src.sample([(lon, lat)]):
                v = float(val[0])
                if 0 < v < 5000:
                    return v
        except Exception:
            continue
    return 0.5


if __name__ == "__main__":
    args = parse_args()
    process_grid(args.districts, args.grid, args.grid_output, args.soil_dir, args.overwrite)
    create_simplified_boundary(args.districts, args.boundary_output, args.overwrite)
    print("Done!")
