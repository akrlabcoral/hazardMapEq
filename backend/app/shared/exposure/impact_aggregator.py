"""Shared impact aggregation helpers.

The current implementation aggregates annotated grid-cell hazard values into
district and state summaries.  It intentionally stays hazard-neutral at the
package boundary, while preserving the existing earthquake result shape.
"""
from __future__ import annotations

import numpy as np

from app.config import RISK_THRESHOLDS

_UNKNOWN = {"Unknown", "Offshore/Unknown"}


def aggregate_impact(
    grid_features: list,
    raw_values: np.ndarray,
    norm_values: np.ndarray,
) -> tuple[list[dict], dict[str, dict]]:
    district_scores: dict[str, dict] = {}
    state_scores: dict[str, dict] = {}

    for i, feature in enumerate(grid_features):
        props = feature["properties"]
        district_name = props.get("district", "Unknown")
        state_name = props.get("state", "Unknown")
        raw_score = float(props.get("pga_final", raw_values[i]))
        norm_score = float(props.get("fused_hazard", norm_values[i]))

        if district_name not in _UNKNOWN:
            district = district_scores.setdefault(district_name, {"max_pga": 0.0, "severe_cells": 0})
            if raw_score > district["max_pga"]:
                district["max_pga"] = raw_score
            if norm_score > 0.6:
                district["severe_cells"] += 1

        if state_name not in _UNKNOWN:
            state = state_scores.setdefault(state_name, {
                "max_pga": 0.0,
                "total_pga": 0.0,
                "cell_count": 0,
                "severe_cells": 0,
                "total_pop_affected": 0,
            })
            if raw_score > state["max_pga"]:
                state["max_pga"] = raw_score
            if norm_score > 0.6:
                state["severe_cells"] += 1
            state["total_pga"] += raw_score
            state["cell_count"] += 1

            if raw_score > 0.02:
                state["total_pop_affected"] += props.get("population", 0)

    district_summary = [
        {"district": name, "max_pga": round(values["max_pga"], 3), "severe_cells": values["severe_cells"]}
        for name, values in district_scores.items()
        if values["max_pga"] > 0.1
    ]

    state_summary: dict[str, dict] = {}
    for name, values in state_scores.items():
        if values["cell_count"] == 0:
            continue
        avg_pga = values["total_pga"] / values["cell_count"]
        max_pga = values["max_pga"]
        state_summary[name] = {
            "state": name,
            "avg_pga": round(avg_pga, 3),
            "max_pga": round(max_pga, 3),
            "severe_cells": values["severe_cells"],
            "risk_category": _classify_risk(max_pga),
            "damage_score": min(int(avg_pga * 50 + max_pga * 50), 100),
            "pop_affected": int(values["total_pop_affected"]),
        }

    return district_summary, state_summary


def _classify_risk(max_pga: float) -> str:
    if max_pga > RISK_THRESHOLDS["EXTREME"]:
        return "EXTREME"
    if max_pga > RISK_THRESHOLDS["SEVERE"]:
        return "SEVERE"
    if max_pga > RISK_THRESHOLDS["HIGH"]:
        return "HIGH"
    if max_pga > RISK_THRESHOLDS["MODERATE"]:
        return "MODERATE"
    return "LOW"
