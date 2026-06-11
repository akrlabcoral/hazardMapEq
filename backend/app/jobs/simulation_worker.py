"""
SimulationRunner — unified entry point for running PGA simulations.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
import logging
import time

import numpy as np

from app.config import GRID_PATH
from app.layers.pga.engine import PGAEngine
from app.layers.pga.selector import GMPESelector
from app.layers.soil.engine import SoilEngine
from app.models.repository import save_simulation
from app.services.impact_aggregator import aggregate_impact

logger = logging.getLogger("hazardmap.worker")


def generate_contour_geojson(features: list, pga_values: np.ndarray) -> dict:
    from app.services.contour_generator import generate_contour_geojson as _generate

    return _generate(features, pga_values)


@dataclass
class GridContext:
    geojson: dict
    centroid_lons: np.ndarray
    centroid_lats: np.ndarray
    soil_precomputed: bool = False

    @classmethod
    def load(cls, path: str = GRID_PATH) -> "GridContext":
        with open(path) as f:
            geojson = json.load(f)
        return cls.load_from_geojson(geojson)

    @classmethod
    def load_from_geojson(cls, geojson: dict) -> "GridContext":
        features = geojson["features"]
        lons = np.array([f["properties"]["centroid_lon"] for f in features], dtype=np.float64)
        lats = np.array([f["properties"]["centroid_lat"] for f in features], dtype=np.float64)
        logger.info("[SimRunner] Grid loaded (%d cells)", len(features))
        return cls(geojson=geojson, centroid_lons=lons, centroid_lats=lats)

    def clone_grid(self) -> dict:
        return {
            "type": self.geojson["type"],
            "features": [
                {
                    "type": feat["type"],
                    "geometry": feat["geometry"],
                    "properties": feat["properties"].copy(),
                }
                for feat in self.geojson["features"]
            ],
        }


class SimulationRunner:
    _default: "SimulationRunner | None" = None

    def __init__(self, grid_context: GridContext | None = None) -> None:
        self.grid_context = grid_context or GridContext.load()
        self.pga_engine = PGAEngine()
        self.soil_engine = SoilEngine()
        self._precompute_static_soil()

    @classmethod
    def initialize_default(cls) -> "SimulationRunner":
        cls._default = cls()
        return cls._default

    @classmethod
    def get_default(cls) -> "SimulationRunner":
        if cls._default is None:
            cls._default = cls()
        return cls._default

    @staticmethod
    def run(
        latitude: float,
        longitude: float,
        magnitude: float,
        depth_km: float,
        gmpe_params: dict | None = None,
        event_id: int | None = None,
        triggered_by: str = "manual",
    ) -> dict:
        return SimulationRunner.get_default().run_simulation(
            latitude=latitude,
            longitude=longitude,
            magnitude=magnitude,
            depth_km=depth_km,
            gmpe_params=gmpe_params,
            event_id=event_id,
            triggered_by=triggered_by,
        )

    def _precompute_static_soil(self) -> None:
        features = self.grid_context.geojson["features"]
        try:
            self.soil_engine.compute(features)
            self.grid_context.soil_precomputed = True
            logger.info("[SimRunner] Static soil properties precomputed.")
        except Exception as exc:
            self.grid_context.soil_precomputed = False
            logger.warning("[SimRunner] Soil precompute failed, using per-run fallback: %s", exc)

    def _annotate_features(self, features: list, raw_pga: np.ndarray, norm_pga: np.ndarray) -> np.ndarray:
        for i, feat in enumerate(features):
            p = feat["properties"]
            p["pga_base"] = round(float(raw_pga[i]), 4)
            p["pga_normalized"] = round(float(norm_pga[i]), 4)

            if "soil_factor" not in p:
                p["soil_normalized"] = 0.0
                p["soil_factor"] = 1.0
                p["site_class"] = "B"
                p["vs30"] = 760.0
                p["soil_type"] = "nodata"

        if not self.grid_context.soil_precomputed:
            try:
                self.soil_engine.compute(features)
            except Exception as exc:
                logger.warning("[SimRunner] SoilEngine failed, using neutral factors: %s", exc)

        soil_norm = self.soil_engine.normalize([f["properties"].get("soil_factor", 1.0) for f in features])
        for i, feat in enumerate(features):
            feat["properties"]["soil_normalized"] = round(float(soil_norm[i]), 4)

        pga_final_arr = np.array([
            float(raw_pga[i]) * float(features[i]["properties"].get("soil_factor", 1.0))
            for i in range(len(features))
        ], dtype=np.float64)
        norm_pga_final = self.pga_engine.normalize(pga_final_arr)

        for i, feat in enumerate(features):
            p = feat["properties"]
            p["pga_final"] = round(float(pga_final_arr[i]), 4)
            p["fused_hazard"] = round(float(norm_pga_final[i]), 4)

        return pga_final_arr

    def run_simulation(
        self,
        latitude: float,
        longitude: float,
        magnitude: float,
        depth_km: float,
        gmpe_params: dict | None = None,
        event_id: int | None = None,
        triggered_by: str = "manual",
    ) -> dict:
        total_started = time.perf_counter()
        t_region = time.perf_counter()
        gmpe, region = GMPESelector.select(latitude, longitude, gmpe_params)
        region_ms = (time.perf_counter() - t_region) * 1000

        t_clone = time.perf_counter()
        grid = self.grid_context.clone_grid()
        features = grid["features"]
        clone_ms = (time.perf_counter() - t_clone) * 1000

        t_pga = time.perf_counter()
        raw_pga = self.pga_engine.compute_from_arrays(
            self.grid_context.centroid_lons,
            self.grid_context.centroid_lats,
            magnitude,
            latitude,
            longitude,
            depth_km,
            gmpe,
        )
        norm_pga = self.pga_engine.normalize(raw_pga)
        pga_ms = (time.perf_counter() - t_pga) * 1000

        t_annotate = time.perf_counter()
        pga_final = self._annotate_features(features, raw_pga, norm_pga)
        annotate_ms = (time.perf_counter() - t_annotate) * 1000

        max_idx = np.argmax(pga_final)
        max_feat = features[max_idx]["properties"]
        logger.info(
            "[SimRunner] region=%s gmpe=%s mag=%s rawPGA=%s finalPGA=%s",
            region.value,
            gmpe.__class__.__name__,
            magnitude,
            max_feat["pga_base"],
            max_feat["pga_final"],
        )

        t_aggregate = time.perf_counter()
        district_summary, state_summary = aggregate_impact(features, raw_pga, norm_pga)
        aggregate_ms = (time.perf_counter() - t_aggregate) * 1000

        t_contour = time.perf_counter()
        contour_geojson = generate_contour_geojson(features, pga_final)
        contour_ms = (time.perf_counter() - t_contour) * 1000

        t_save = time.perf_counter()
        sim_id = save_simulation(
            lat=latitude,
            lon=longitude,
            mag=magnitude,
            depth=depth_km,
            district_summary=district_summary,
            grid_geojson=grid,
            event_id=event_id,
            triggered_by=triggered_by,
        )
        save_ms = (time.perf_counter() - t_save) * 1000

        logger.info(
            "[SimTiming] sim_id=%s triggered_by=%s region_ms=%.0f clone_ms=%.0f pga_ms=%.0f "
            "annotate_ms=%.0f aggregate_ms=%.0f contour_ms=%.0f save_ms=%.0f total_ms=%.0f",
            sim_id,
            triggered_by,
            region_ms,
            clone_ms,
            pga_ms,
            annotate_ms,
            aggregate_ms,
            contour_ms,
            save_ms,
            (time.perf_counter() - total_started) * 1000,
        )

        return {
            "simulation_id": sim_id,
            "grid_geojson": grid,
            "contour_geojson": contour_geojson,
            "district_summary": district_summary,
            "state_summary": state_summary,
            "triggered_by": triggered_by,
            "event_id": event_id,
        }
