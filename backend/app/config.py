"""
app/config.py

Centralized configuration for HazardMap.

The module still exposes the historical constants used across the codebase,
but those values now come from a typed Settings object so runtime configuration
can be moved to environment variables without changing public imports.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Data Paths
# ---------------------------------------------------------------------------
def _csv_env(name: str, default: str) -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://hazardmap:hazardmap_dev@localhost:5432/hazardmap",
    )
    cors_allowed_origins: list[str] = field(
        default_factory=lambda: _csv_env("CORS_ALLOWED_ORIGINS", "*")
    )
    grid_path: str = os.environ.get("GRID_PATH", "data/grids/nationwide_20km.geojson")
    vs30_raster_path: str = os.environ.get("VS30_RASTER_PATH", "/app/data/soil/india_vs30.tif")
    usgs_poll_interval_seconds: int = int(os.environ.get("USGS_POLL_INTERVAL_SECONDS", "60"))
    ncs_poll_interval_seconds: int = int(os.environ.get("NCS_POLL_INTERVAL_SECONDS", "60"))
    auto_sim_min_magnitude: float = float(os.environ.get("AUTO_SIM_MIN_MAGNITUDE", "0.0"))
    auto_sim_max_depth_km: float = float(os.environ.get("AUTO_SIM_MAX_DEPTH_KM", "300.0"))
    db_min_connections: int = int(os.environ.get("DB_MIN_CONNECTIONS", "2"))
    db_max_connections: int = int(os.environ.get("DB_MAX_CONNECTIONS", "10"))


settings = Settings()

GRID_PATH = settings.grid_path

# ---------------------------------------------------------------------------
# PGA Intensity Scale — thresholds in units of g (gravitational acceleration)
# Matches the USGS ShakeMap intensity definitions
# ---------------------------------------------------------------------------
PGA_LEVELS = [
    0.001,   # < 0.001g : essentially zero shaking
    0.02,    # I–III    : No perceptible effect
    0.115,   # IV–V     : Light
    0.215,   # VI       : Moderate
    0.401,   # VII      : Strong
    0.747,   # VIII     : Very Strong
    1.39,    # IX       : Severe
]
# The last level is computed dynamically as max(5.0, observed_max + 1.0)

# Human-readable label for each band (between consecutive levels)
PGA_LABELS = [
    "No Effect",     # < 0.02
    "Light",         # 0.02 – 0.115
    "Moderate",      # 0.115 – 0.215
    "Strong",        # 0.215 – 0.401
    "Very Strong",   # 0.401 – 0.747
    "Severe",        # 0.747 – 1.39
    "Violent",       # > 1.39
]

# Hex colors for each band — matches the frontend Legend component
PGA_COLORS = [
    "#3b82f6",  # Blue       — No Effect
    "#22c55e",  # Green      — Light
    "#eab308",  # Yellow     — Moderate
    "#f97316",  # Orange     — Strong
    "#ea580c",  # Dark Orange — Very Strong
    "#ef4444",  # Red        — Severe
    "#7e22ce",  # Purple     — Violent
]

# ---------------------------------------------------------------------------
# Risk Category Thresholds (for state/district summary)
# ---------------------------------------------------------------------------
RISK_THRESHOLDS = {
    "EXTREME":  0.8,
    "SEVERE":   0.6,
    "HIGH":     0.4,
    "MODERATE": 0.2,
}

# ---------------------------------------------------------------------------
# Contour Generation Settings
# ---------------------------------------------------------------------------
CONTOUR_GRID_SIZE = 400    # resolution of the interpolation meshgrid (NxN)
CONTOUR_BLUR_SIGMA = 1.5   # Gaussian blur sigma — smooths jagged contour edges
CONTOUR_FILL_OPACITY = 0.6

# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------
MAX_EXPECTED_PGA = 1.0  # PGA of 1.0g = max severity (normalized score = 1.0)
