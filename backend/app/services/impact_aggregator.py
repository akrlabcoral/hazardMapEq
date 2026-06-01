"""
app/services/impact_aggregator.py

Aggregates per-cell PGA values into district and state level summaries.
Extracted from simulate.py to keep the route handler lean.
"""
from __future__ import annotations
import numpy as np
from app.config import RISK_THRESHOLDS

_UNKNOWN = {"Unknown", "Offshore/Unknown"}


def aggregate_impact(
    grid_features: list,
    raw_pga: np.ndarray,
    norm_pga: np.ndarray,
) -> tuple[list[dict], dict[str, dict]]:
    """
    Walk through all grid cells and build district and state summaries.

    Args:
        grid_features : list of GeoJSON feature dicts (already property-annotated)
        raw_pga       : 1-D numpy array of raw PGA values in g
        norm_pga      : 1-D numpy array of normalized PGA values [0, 1]

    Returns:
        district_summary : list of dicts — one per significantly affected district
        state_summary    : dict mapping state name → summary dict
    """
    district_scores: dict[str, dict] = {}
    state_scores:    dict[str, dict] = {}

    for i, feature in enumerate(grid_features):
        props        = feature["properties"]
        district_name = props.get("district", "Unknown")
        state_name    = props.get("state",    "Unknown")
        raw_score  = float(raw_pga[i])
        norm_score = float(norm_pga[i])

        # --- District aggregation ---
        if district_name not in _UNKNOWN:
            d = district_scores.setdefault(district_name, {"max_pga": 0.0, "severe_cells": 0})
            if raw_score > d["max_pga"]:
                d["max_pga"] = raw_score
            if norm_score > 0.6:
                d["severe_cells"] += 1

        # --- State aggregation ---
        if state_name not in _UNKNOWN:
            s = state_scores.setdefault(state_name, {
                "max_pga":     0.0,
                "total_pga":   0.0,
                "cell_count":  0,
                "severe_cells": 0,
            })
            if raw_score > s["max_pga"]:
                s["max_pga"] = raw_score
            if norm_score > 0.6:
                s["severe_cells"] += 1
            s["total_pga"]  += raw_score
            s["cell_count"] += 1

    # --- Format district summary ---
    district_summary = [
        {"district": k, "max_pga": round(v["max_pga"], 3), "severe_cells": v["severe_cells"]}
        for k, v in district_scores.items()
        if v["max_pga"] > 0.1
    ]

    # --- Format state summary ---
    state_summary: dict[str, dict] = {}
    for k, v in state_scores.items():
        if v["cell_count"] == 0:
            continue
        avg_pga = v["total_pga"] / v["cell_count"]
        max_pga = v["max_pga"]
        risk    = _classify_risk(max_pga)
        damage_score = min(int(avg_pga * 50 + max_pga * 50), 100)
        pop_affected = int(
            v["cell_count"] * 25000 if avg_pga > 0.1 else v["severe_cells"] * 3 * 25000
        )
        state_summary[k] = {
            "state":         k,
            "avg_pga":       round(avg_pga, 3),
            "max_pga":       round(max_pga, 3),
            "severe_cells":  v["severe_cells"],
            "risk_category": risk,
            "damage_score":  damage_score,
            "pop_affected":  pop_affected,
        }

    return district_summary, state_summary


def _classify_risk(max_pga: float) -> str:
    if max_pga > RISK_THRESHOLDS["EXTREME"]:  return "EXTREME"
    if max_pga > RISK_THRESHOLDS["SEVERE"]:   return "SEVERE"
    if max_pga > RISK_THRESHOLDS["HIGH"]:     return "HIGH"
    if max_pga > RISK_THRESHOLDS["MODERATE"]: return "MODERATE"
    return "LOW"
