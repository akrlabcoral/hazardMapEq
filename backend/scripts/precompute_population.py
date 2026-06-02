import json
import logging
from pathlib import Path
from rasterstats import zonal_stats

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

GRID_PATH = Path("data/grids/nationwide_20km.geojson")
RASTER_PATH = Path("data/population/ind_pd_2020_1km.tif")

def precompute():
    if not GRID_PATH.exists():
        logger.error(f"Grid file not found: {GRID_PATH}")
        return
    if not RASTER_PATH.exists():
        logger.error(f"Raster file not found: {RASTER_PATH}")
        return

    logger.info("Loading grid GeoJSON...")
    with open(GRID_PATH, "r") as f:
        grid = json.load(f)
    
    features = grid.get("features", [])
    if not features:
        logger.error("No features found in the grid.")
        return

    logger.info(f"Loaded {len(features)} cells. Running zonal stats...")

    # zonal_stats takes a list of GeoJSON features and a raster path
    # We want 'sum', 'mean', 'max'. We ignore nodata (-99999) implicitly by default raster metadata, 
    # but we can pass nodata=-99999 just to be safe.
    stats = zonal_stats(
        features,
        str(RASTER_PATH),
        stats=["sum", "mean", "max"],
        nodata=-99999,
        geojson_out=True
    )

    logger.info("Zonal stats complete. Updating features...")
    
    # zonal_stats with geojson_out=True returns the updated features directly
    # The stats are added to the 'properties' dict.
    for feat in stats:
        props = feat["properties"]
        # Convert sum to an integer population count
        pop = int(props.get("sum") or 0)
        mean_den = round(props.get("mean") or 0, 2)
        max_den = round(props.get("max") or 0, 2)
        
        # Add our clean keys and delete the raw rasterstats keys if we want
        props["population"] = pop
        props["mean_density"] = mean_den
        props["max_density"] = max_den
        
        # Cleanup rasterstats keys so the geojson doesn't get cluttered
        props.pop("sum", None)
        props.pop("mean", None)
        props.pop("max", None)

    grid["features"] = stats

    logger.info(f"Saving updated grid back to {GRID_PATH}...")
    with open(GRID_PATH, "w") as f:
        json.dump(grid, f)
        
    logger.info("Done! Grid has been enriched with population zonal stats.")

if __name__ == "__main__":
    precompute()
