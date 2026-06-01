#!/usr/bin/env python3
"""
Phase 1: Stage all state soil GeoTIFF files from Desktop into the backend
data directory so they are accessible inside the Docker container.

Run from the project root:
    python3 backend/scripts/stage_soil_rasters.py
"""

import os
import shutil
import glob

SRC_ROOT = "/Users/manasrai/Desktop/DATA/states/Soils"
DST_DIR  = os.path.join(os.path.dirname(__file__), "..", "data", "soil", "states")

def stage_rasters():
    os.makedirs(DST_DIR, exist_ok=True)

    tif_paths = sorted(glob.glob(os.path.join(SRC_ROOT, "**", "*.tif"), recursive=True))
    print(f"Found {len(tif_paths)} raster files in source directory.\n")

    copied, skipped, failed = 0, 0, 0

    for src_path in tif_paths:
        filename = os.path.basename(src_path)
        dst_path = os.path.join(DST_DIR, filename)

        # Skip if already exists with same size (avoid redundant copies)
        if os.path.exists(dst_path) and os.path.getsize(dst_path) == os.path.getsize(src_path):
            print(f"  [SKIP]  {filename} (already staged)")
            skipped += 1
            continue

        try:
            shutil.copy2(src_path, dst_path)
            print(f"  [COPY]  {filename}")
            copied += 1
        except Exception as e:
            print(f"  [FAIL]  {filename}: {e}")
            failed += 1

    print(f"\nDone. Copied: {copied}  Skipped: {skipped}  Failed: {failed}")
    print(f"Staged rasters available at: {os.path.abspath(DST_DIR)}")

if __name__ == "__main__":
    stage_rasters()
