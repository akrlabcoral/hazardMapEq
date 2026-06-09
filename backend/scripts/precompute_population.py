from __future__ import annotations

import argparse
import json
import logging

from rasterstats import zonal_stats

from common import DATA_DIR, add_overwrite, ensure_can_write, path_arg

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Precompute population zonal stats for a grid GeoJSON.")
    parser.add_argument("--grid", type=path_arg, default=DATA_DIR / "grids" / "nationwide_20km.geojson")
    parser.add_argument("--raster", type=path_arg, default=DATA_DIR / "population" / "ind_pd_2020_1km.tif")
    parser.add_argument("--output", type=path_arg, default=DATA_DIR / "grids" / "nationwide_20km.geojson")
    add_overwrite(parser)
    return parser.parse_args()


def precompute(grid_path, raster_path, output_path, overwrite: bool = False) -> None:
    if not grid_path.exists():
        raise SystemExit(f"Grid file not found: {grid_path}")
    if not raster_path.exists():
        raise SystemExit(f"Raster file not found: {raster_path}")
    if output_path != grid_path:
        ensure_can_write(output_path, overwrite)
    elif not overwrite:
        raise SystemExit("Refusing to overwrite grid in place. Pass --overwrite.")

    logger.info("Loading grid GeoJSON...")
    with open(grid_path, "r") as f:
        grid = json.load(f)

    features = grid.get("features", [])
    if not features:
        raise SystemExit("No features found in the grid.")

    logger.info("Loaded %d cells. Running zonal stats...", len(features))
    stats = zonal_stats(features, str(raster_path), stats=["sum", "mean", "max"], nodata=-99999, geojson_out=True)

    for feat in stats:
        props = feat["properties"]
        props["population"] = int(props.get("sum") or 0)
        props["mean_density"] = round(props.get("mean") or 0, 2)
        props["max_density"] = round(props.get("max") or 0, 2)
        props.pop("sum", None)
        props.pop("mean", None)
        props.pop("max", None)

    grid["features"] = stats
    logger.info("Saving updated grid to %s...", output_path)
    with open(output_path, "w") as f:
        json.dump(grid, f)


if __name__ == "__main__":
    args = parse_args()
    precompute(args.grid, args.raster, args.output, args.overwrite)
