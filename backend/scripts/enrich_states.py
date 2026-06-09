from __future__ import annotations

import argparse
import json

import geopandas as gpd

from common import DATA_DIR, PROJECT_ROOT, add_overwrite, ensure_can_write, path_arg


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Add numeric state IDs and enrich grid cells with state names.")
    parser.add_argument("--states", type=path_arg, default=PROJECT_ROOT / "frontend" / "public" / "data" / "india_states.geojson")
    parser.add_argument("--grid", type=path_arg, default=DATA_DIR / "grids" / "nationwide_20km.geojson")
    parser.add_argument("--states-output", type=path_arg, default=PROJECT_ROOT / "frontend" / "public" / "data" / "india_states.geojson")
    parser.add_argument("--grid-output", type=path_arg, default=DATA_DIR / "grids" / "nationwide_20km.geojson")
    add_overwrite(parser)
    return parser.parse_args()


def enrich_states(states_path, grid_path, states_output, grid_output, overwrite: bool = False) -> None:
    if states_output == states_path and not overwrite:
        raise SystemExit("Refusing to overwrite states in place. Pass --overwrite.")
    if grid_output == grid_path and not overwrite:
        raise SystemExit("Refusing to overwrite grid in place. Pass --overwrite.")
    if states_output != states_path:
        ensure_can_write(states_output, overwrite)
    if grid_output != grid_path:
        ensure_can_write(grid_output, overwrite)

    with open(states_path, "r") as f:
        states_data = json.load(f)
    for i, feature in enumerate(states_data["features"]):
        feature["id"] = i + 1
        feature["properties"]["id"] = i + 1
    with open(states_output, "w") as f:
        json.dump(states_data, f)

    states_gdf = gpd.read_file(states_output)
    grid_gdf = gpd.read_file(grid_path)
    states_gdf = states_gdf.to_crs(grid_gdf.crs)
    grid_gdf["geometry_centroid"] = grid_gdf.centroid
    grid_pts = grid_gdf.copy()
    grid_pts.set_geometry("geometry_centroid", inplace=True)
    joined = gpd.sjoin(grid_pts, states_gdf[["state", "geometry"]], how="left", predicate="intersects")

    with open(grid_path, "r") as f:
        grid_data = json.load(f)
    state_mapping = joined["state"].fillna("Unknown").tolist()
    for i, feature in enumerate(grid_data["features"]):
        feature["properties"]["state"] = state_mapping[i]
    with open(grid_output, "w") as f:
        json.dump(grid_data, f)


if __name__ == "__main__":
    args = parse_args()
    enrich_states(args.states, args.grid, args.states_output, args.grid_output, args.overwrite)
