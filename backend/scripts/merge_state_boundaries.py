from __future__ import annotations

import argparse

import geopandas as gpd

from common import DATA_DIR, add_overwrite, ensure_can_write, path_arg


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Dissolve district boundaries into state boundaries.")
    parser.add_argument("--districts", type=path_arg, default=DATA_DIR / "india_districts.geojson")
    parser.add_argument("--output", type=path_arg, default=DATA_DIR / "india" / "india_states.geojson")
    add_overwrite(parser)
    return parser.parse_args()


def generate_state_boundaries(districts_file, output_file, overwrite: bool = False) -> None:
    ensure_can_write(output_file, overwrite)
    print(f"Loading districts from {districts_file}...")
    gdf = gpd.read_file(districts_file)
    states_gdf = gdf.dissolve(by="STATE_UT")
    states_gdf["geometry"] = states_gdf["geometry"].simplify(0.01, preserve_topology=True)
    states_gdf = states_gdf.reset_index()[["STATE_UT", "geometry"]]
    states_gdf = states_gdf.rename(columns={"STATE_UT": "state"})
    print(f"Writing {len(states_gdf)} states to {output_file}...")
    states_gdf.to_file(output_file, driver="GeoJSON")


if __name__ == "__main__":
    args = parse_args()
    generate_state_boundaries(args.districts, args.output, args.overwrite)
