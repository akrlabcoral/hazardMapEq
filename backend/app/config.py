"""
app/config.py

Centralized configuration for all HazardMap backend constants.
Import from here instead of hardcoding magic numbers inline.
"""

# ---------------------------------------------------------------------------
# Data Paths
# ---------------------------------------------------------------------------
GRID_PATH = "data/grids/nationwide_20km.geojson"

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
