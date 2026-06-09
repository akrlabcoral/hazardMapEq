from __future__ import annotations

import argparse

import geopandas as gpd

from common import DATA_DIR, PROJECT_ROOT, add_overwrite, ensure_can_write, path_arg


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Spatially enrich grid cells with state names.")
    parser.add_argument("--grid", type=path_arg, default=DATA_DIR / "grids" / "nationwide_20km.geojson")
    parser.add_argument("--states", type=path_arg, default=PROJECT_ROOT / "frontend" / "public" / "data" / "india_states.geojson")
    parser.add_argument("--output", type=path_arg, default=DATA_DIR / "grids" / "nationwide_20km_enriched.geojson")
    add_overwrite(parser)
    return parser.parse_args()


def enrich_grid(grid_path, states_path, output_path, overwrite: bool = False) -> None:
    ensure_can_write(output_path, overwrite)
    grid = gpd.read_file(grid_path)
    states = gpd.read_file(states_path).to_crs(grid.crs)
    grid["geometry_centroid"] = grid.centroid
    grid_pts = grid.copy()
    grid_pts["geometry"] = grid_pts["geometry_centroid"]
    joined = gpd.sjoin(grid_pts, states, how="left", predicate="intersects")
    grid["state"] = joined["state"].fillna("Unknown")
    grid = grid.drop(columns=["geometry_centroid"])
    grid.to_file(output_path, driver="GeoJSON")
    print(f"Saved enriched grid to {output_path}")


if __name__ == "__main__":
    args = parse_args()
    enrich_grid(args.grid, args.states, args.output, args.overwrite)
