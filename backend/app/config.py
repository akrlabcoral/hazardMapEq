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


def _bool_env(name: str, default: str = "false") -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = os.environ.get(
        "DATABASE_URL",
        ""
    )
    cors_allowed_origins: list[str] = field(
        default_factory=lambda: _csv_env("CORS_ALLOWED_ORIGINS", "")
    )
    grid_path: str = os.environ.get("GRID_PATH", "data/grids/nationwide_20km.geojson")
    vs30_raster_path: str = os.environ.get("VS30_RASTER_PATH", "/app/data/soil/india_vs30.tif")
    usgs_poll_interval_seconds: int = int(os.environ.get("USGS_POLL_INTERVAL_SECONDS", "60"))
    ncs_poll_interval_seconds: int = int(os.environ.get("NCS_POLL_INTERVAL_SECONDS", "60"))
    auto_sim_min_magnitude: float = float(os.environ.get("AUTO_SIM_MIN_MAGNITUDE", "0.0"))
    auto_sim_max_depth_km: float = float(os.environ.get("AUTO_SIM_MAX_DEPTH_KM", "300.0"))
    db_min_connections: int = int(os.environ.get("DB_MIN_CONNECTIONS", "2"))
    db_max_connections: int = int(os.environ.get("DB_MAX_CONNECTIONS", "10"))
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    redis_lock_fail_open: bool = _bool_env("REDIS_LOCK_FAIL_OPEN")
    enable_dev_routes: bool = _bool_env("ENABLE_DEV_ROUTES")
    ws_max_clients: int = int(os.environ.get("WS_MAX_CLIENTS", "10000"))
    ws_send_timeout_seconds: float = float(os.environ.get("WS_SEND_TIMEOUT_SECONDS", "5.0"))
    contour_grid_size: int = int(os.environ.get("CONTOUR_GRID_SIZE", "300"))


settings = Settings()

GRID_PATH = settings.grid_path

# ---------------------------------------------------------------------------
# PGA Intensity Scale — thresholds in units of g (gravitational acceleration)
# Matches the USGS ShakeMap intensity definitions
# ---------------------------------------------------------------------------
PGA_LEVELS = [
    0.014,   # IV       : Light
    0.039,   # V        : Moderate
    0.092,   # VI       : Strong
    0.18,    # VII      : Very Strong
    0.34,    # VIII     : Severe
    0.65,    # IX       : Violent
    1.24,    # X+       : Extreme
]
# The last level is computed dynamically as max(5.0, observed_max + 1.0)

# Hex colors for each MMI band.
PGA_COLORS = [
    "#a0e6ff",  # IV. Light
    "#80ffff",  # V. Moderate
    "#7cd37c",  # VI. Strong
    "#ffec7d",  # VII. Very Strong
    "#ffb834",  # VIII. Severe
    "#ff6666",  # IX. Violent
    "#cc0000",  # X+. Extreme
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
CONTOUR_GRID_SIZE = settings.contour_grid_size    # resolution of the interpolation meshgrid (NxN)
CONTOUR_BLUR_SIGMA = 1.5   # Gaussian blur sigma — smooths jagged contour edges
CONTOUR_FILL_OPACITY = 0.82

# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------
MAX_EXPECTED_PGA = 1.0  # PGA of 1.0g = max severity (normalized score = 1.0)
