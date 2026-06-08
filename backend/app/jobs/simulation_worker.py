"""
app/jobs/simulation_worker.py

SimulationRunner — unified entry point for running PGA simulations.

Can be called from:
  - asyncio worker loop  (auto-triggered events)
  - HTTP POST /simulate-earthquake  (manual trigger)

Key design: matplotlib's contourf is synchronous and blocks for 2-3s.
The async wrapper uses asyncio.to_thread() so the event loop stays free
during contour generation — WebSocket pings and the poller won't stall.
"""
from __future__ import annotations

import copy
import json
import logging

import numpy as np

from app.config import GRID_PATH
from app.layers.pga.engine import PGAEngine
from app.layers.pga.selector import GMPESelector
from app.layers.soil.engine import SoilEngine
from app.services.impact_aggregator import aggregate_impact
from app.services.contour_generator import generate_contour_geojson
from app.models.repository import save_simulation

logger = logging.getLogger("hazardmap.worker")

# ---------------------------------------------------------------------------
# Pre-load nationwide grid once — shared across all calls
# ---------------------------------------------------------------------------
try:
    with open(GRID_PATH) as f:
        _NATIONWIDE_GRID: dict = json.load(f)
    logger.info("[SimRunner] Grid loaded (%d cells)", len(_NATIONWIDE_GRID["features"]))
except Exception as exc:
    _NATIONWIDE_GRID = None
    logger.error("[SimRunner] Failed to load grid: %s", exc)

_pga_engine  = PGAEngine()
_soil_engine = SoilEngine()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _annotate_features(features: list, raw_pga: np.ndarray, norm_pga: np.ndarray) -> np.ndarray:
    # Step 1: Annotate base PGA values
    for i, feat in enumerate(features):
        p = feat["properties"]
        p["pga_base"]        = round(float(raw_pga[i]),  4)
        p["pga_normalized"]  = round(float(norm_pga[i]), 4)
        p["soil_normalized"] = 0.0
        p["soil_factor"]     = 1.0  # default: neutral (Site Class B)
        p["site_class"]      = "B"
        p["vs30"]            = 760.0
        p["soil_type"]       = "nodata"

    # Step 2: Enrich with Vs30 / site class / soil amplification factor
    try:
        _soil_engine.compute(features)
        soil_norm = _soil_engine.normalize([f["properties"]["soil_factor"] for f in features])
        for i, feat in enumerate(features):
            feat["properties"]["soil_normalized"] = round(float(soil_norm[i]), 4)
    except Exception as exc:
        logger.warning("[SimRunner] SoilEngine failed, using neutral factors: %s", exc)

    # Step 3: Apply soil amplification to produce final PGA and re-normalize
    pga_final_arr = np.array([
        float(raw_pga[i]) * float(features[i]["properties"].get("soil_factor", 1.0))
        for i in range(len(features))
    ], dtype=np.float64)
    norm_pga_final = _pga_engine.normalize(pga_final_arr)

    for i, feat in enumerate(features):
        p = feat["properties"]
        p["pga_final"]    = round(float(pga_final_arr[i]), 4)
        p["fused_hazard"] = round(float(norm_pga_final[i]), 4)

    return pga_final_arr


# ---------------------------------------------------------------------------
# Synchronous core — runs inside a thread via asyncio.to_thread()
# ---------------------------------------------------------------------------
class SimulationRunner:
    @staticmethod
    def run(
        latitude:    float,
        longitude:   float,
        magnitude:   float,
        depth_km:    float,
        gmpe_params: dict | None = None,
        event_id:    int  | None = None,
        triggered_by: str = "manual",
    ) -> dict:
        """
        Run a full simulation synchronously.
        Call via asyncio.to_thread(SimulationRunner.run, ...) from async contexts
        to avoid blocking the event loop during contour generation.
        """
        if _NATIONWIDE_GRID is None:
            raise RuntimeError("Nationwide grid not loaded.")

        # Determine the appropriate GMPE model for this region
        gmpe, region = GMPESelector.select(latitude, longitude, gmpe_params)

        # Shallow copy the grid and features list.
        # We also shallow copy each feature and its properties dict so we can safely mutate properties.
        # CRITICAL MEMORY OPTIMIZATION: We pass geometry by reference! No cloning coordinate arrays!
        grid = {
            "type": _NATIONWIDE_GRID["type"],
            "features": []
        }
        for feat in _NATIONWIDE_GRID["features"]:
            grid["features"].append({
                "type": feat["type"],
                "geometry": feat["geometry"],  # Pass-by-reference
                "properties": feat["properties"].copy() # Shallow copy for mutation
            })
        features = grid["features"]

        raw_pga  = _pga_engine.compute(features, magnitude, latitude, longitude, depth_km, gmpe)
        norm_pga = _pga_engine.normalize(raw_pga)

        pga_final = _annotate_features(features, raw_pga, norm_pga)

        # Find the cell with the maximum final PGA for diagnostic logging
        max_idx = np.argmax(pga_final)
        max_feat = features[max_idx]["properties"]
        max_lon = max_feat["centroid_lon"]
        max_lat = max_feat["centroid_lat"]
        # Haversine approximation — diagnostic only, not used in PGA calculation
        dlon = np.radians(max_lon - longitude)
        dlat = np.radians(max_lat - latitude)
        a = np.sin(dlat / 2)**2 + np.cos(np.radians(latitude)) * np.cos(np.radians(max_lat)) * np.sin(dlon / 2)**2
        dist_km = 6371.0 * 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
        logger.info(
            "\n=== Developer Diagnostics ===\n" +
            json.dumps({
                "region": region.value,
                "selectedGMPE": gmpe.__class__.__name__,
                "magnitude": magnitude,
                "depth": depth_km,
                "distance": round(dist_km, 2),
                "rawPGA": max_feat["pga_base"],
                "vs30AdjustedPGA": max_feat["pga_final"]
            }, indent=2) + "\n===========================\n"
        )

        district_summary, state_summary = aggregate_impact(features, raw_pga, norm_pga)
        # Use soil-amplified PGA for contours — consistent with the heatmap
        contour_geojson = generate_contour_geojson(features, pga_final)

        sim_id = save_simulation(
            lat          = latitude,
            lon          = longitude,
            mag          = magnitude,
            depth        = depth_km,
            district_summary = district_summary,
            grid_geojson = grid,
            event_id     = event_id,
            triggered_by = triggered_by,
        )

        logger.info(
            "[SimRunner] sim_id=%s triggered_by=%s mag=%s lat=%.3f lon=%.3f",
            sim_id, triggered_by, magnitude, latitude, longitude,
        )

        return {
            "simulation_id":    sim_id,
            "grid_geojson":     grid,
            "contour_geojson":  contour_geojson,
            "district_summary": district_summary,
            "state_summary":    state_summary,
            "triggered_by":     triggered_by,
            "event_id":         event_id,
        }
