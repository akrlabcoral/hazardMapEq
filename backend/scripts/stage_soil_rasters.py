#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil

from common import DATA_DIR, path_arg


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stage state soil GeoTIFF files into backend/data.")
    parser.add_argument(
        "--source",
        type=path_arg,
        default=path_arg("~/Desktop/DATA/states/Soils"),
        help="Directory containing source .tif files.",
    )
    parser.add_argument(
        "--dest",
        type=path_arg,
        default=DATA_DIR / "soil" / "states",
        help="Destination directory for staged .tif files.",
    )
    parser.add_argument("--overwrite", action="store_true", help="Replace existing files even when sizes match.")
    return parser.parse_args()


def stage_rasters(source, dest, overwrite: bool = False) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    tif_paths = sorted(source.rglob("*.tif"))
    print(f"Found {len(tif_paths)} raster files in {source}.\n")

    copied, skipped, failed = 0, 0, 0
    for src_path in tif_paths:
        dst_path = dest / src_path.name
        if (
            dst_path.exists()
            and not overwrite
            and dst_path.stat().st_size == src_path.stat().st_size
        ):
            print(f"  [SKIP]  {src_path.name} (already staged)")
            skipped += 1
            continue

        try:
            shutil.copy2(src_path, dst_path)
            print(f"  [COPY]  {src_path.name}")
            copied += 1
        except Exception as exc:
            print(f"  [FAIL]  {src_path.name}: {exc}")
            failed += 1

    print(f"\nDone. Copied: {copied}  Skipped: {skipped}  Failed: {failed}")
    print(f"Staged rasters available at: {dest}")


if __name__ == "__main__":
    args = parse_args()
    stage_rasters(args.source, args.dest, args.overwrite)
