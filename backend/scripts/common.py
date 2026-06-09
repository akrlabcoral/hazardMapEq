from __future__ import annotations

import argparse
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
DATA_DIR = BACKEND_ROOT / "data"


def path_arg(value: str) -> Path:
    return Path(value).expanduser().resolve()


def ensure_can_write(path: Path, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise SystemExit(f"{path} already exists. Pass --overwrite to replace it.")
    path.parent.mkdir(parents=True, exist_ok=True)


def add_overwrite(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--overwrite", action="store_true", help="Allow replacing an existing output file.")
