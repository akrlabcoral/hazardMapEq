from __future__ import annotations

import json

try:
    import orjson
except ImportError:  # pragma: no cover - lightweight test env fallback
    orjson = None

from app.models.database import get_conn


def _dumps(value) -> str:
    if orjson is not None:
        return orjson.dumps(value).decode("utf-8")
    return json.dumps(value, default=str)


def save_simulation(
    lat: float,
    lon: float,
    mag: float,
    depth: float,
    district_summary: list,
    grid_geojson: dict | None = None,
    event_id: int | None = None,
    triggered_by: str = "manual",
) -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO simulations
                    (latitude, longitude, magnitude, depth,
                     affected_districts_json, grid_geojson_json,
                     event_id, triggered_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    lat,
                    lon,
                    mag,
                    depth,
                    _dumps(district_summary),
                    _dumps(grid_geojson) if grid_geojson is not None else None,
                    event_id,
                    triggered_by,
                ),
            )
            return cur.fetchone()[0]
