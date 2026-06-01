"""
app/api/export.py

GET /api/export/{sim_id}?format=json|csv|geojson

Exports a previously saved simulation in the requested format.
"""
from __future__ import annotations

import csv
import json
from enum import Enum
from io import StringIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models.repository import get_simulation

router = APIRouter()


class ExportFormat(str, Enum):
    json    = "json"
    csv     = "csv"
    geojson = "geojson"


@router.get("/export/{sim_id}")
def export_simulation(
    sim_id: int,
    format: ExportFormat = ExportFormat.json,
):
    sim_data = get_simulation(sim_id)
    if sim_data is None:
        raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found.")

    # ------------------------------------------------------------------
    # JSON — return the full simulation record
    # ------------------------------------------------------------------
    if format == ExportFormat.json:
        return sim_data

    # ------------------------------------------------------------------
    # CSV — district-level summary table
    # ------------------------------------------------------------------
    if format == ExportFormat.csv:
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(["District", "Max PGA (g)", "Severe Cells"])
        for d in sim_data.get("affected_districts", []):
            writer.writerow([
                d.get("district",    ""),
                d.get("max_pga",     0),
                d.get("severe_cells", 0),
            ])
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=simulation_{sim_id}.csv"},
        )

    # ------------------------------------------------------------------
    # GeoJSON — return the stored grid GeoJSON
    # ------------------------------------------------------------------
    if format == ExportFormat.geojson:
        grid = sim_data.get("grid_geojson")
        if grid is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "GeoJSON not available for this simulation. "
                    "Older simulations were saved before GeoJSON storage was enabled. "
                    "Re-run the simulation to generate a new record with GeoJSON."
                ),
            )
        return Response(
            content=json.dumps(grid),
            media_type="application/geo+json",
            headers={"Content-Disposition": f"attachment; filename=simulation_{sim_id}.geojson"},
        )
