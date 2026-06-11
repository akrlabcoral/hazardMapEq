from __future__ import annotations

import time
from collections import OrderedDict
from threading import Lock

from app.models.database import get_conn

_CACHE_TTL_SECONDS = 300
_CACHE_MAX_ENTRIES = 12
_cache_lock = Lock()
_geojson_cache: OrderedDict[tuple[float | None, int | None, str | None], tuple[float, dict]] = OrderedDict()


def save_historic_event(event) -> int | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO historic_events
                    (source_id, source, fingerprint, latitude, longitude,
                     depth_km, magnitude, mag_type, origin_time, place,
                     status, alert_level)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (source_id) DO UPDATE 
                SET updated_at = NOW(), magnitude = EXCLUDED.magnitude
                RETURNING id
                """,
                (
                    event.source_id,
                    event.source,
                    event.fingerprint,
                    event.latitude,
                    event.longitude,
                    event.depth_km,
                    event.magnitude,
                    event.mag_type,
                    event.origin_time,
                    event.place,
                    event.status,
                    event.alert_level,
                ),
            )
            row = cur.fetchone()
            clear_historic_cache()
            return row[0] if row else None


def clear_historic_cache() -> None:
    with _cache_lock:
        _geojson_cache.clear()


def _parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    try:
        west, south, east, north = (float(value.strip()) for value in bbox.split(","))
    except ValueError as exc:
        raise ValueError("bbox must be four comma-separated numbers: west,south,east,north") from exc

    if west > east or south > north:
        raise ValueError("bbox coordinates must be ordered as west,south,east,north")
    return west, south, east, north


def get_historic_events_geojson(
    min_magnitude: float | None = None,
    limit: int | None = None,
    bbox: str | None = None,
) -> dict:
    cache_key = (min_magnitude, limit, bbox)
    now = time.monotonic()
    with _cache_lock:
        cached = _geojson_cache.get(cache_key)
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            _geojson_cache.move_to_end(cache_key)
            return cached[1]
        if cached:
            _geojson_cache.pop(cache_key, None)

    where_clauses: list[str] = []
    params: list[object] = []

    if min_magnitude is not None:
        where_clauses.append("magnitude >= %s")
        params.append(min_magnitude)

    if bbox:
        west, south, east, north = _parse_bbox(bbox)
        where_clauses.append("longitude BETWEEN %s AND %s")
        where_clauses.append("latitude BETWEEN %s AND %s")
        params.extend([west, east, south, north])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    limit_sql = ""
    if limit is not None:
        limit_sql = "LIMIT %s"
        params.append(limit)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT source_id, source, latitude, longitude, depth_km,
                       magnitude, mag_type, origin_time, place, status
                FROM historic_events
                {where_sql}
                ORDER BY origin_time DESC
                {limit_sql}
                """,
                params,
            )
            rows = cur.fetchall()

    features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [longitude, latitude],
            },
            "properties": {
                "id": source_id,
                "source": source,
                "mag": magnitude,
                "mag_type": mag_type,
                "depth": depth_km,
                "time": origin_time.isoformat(),
                "place": place,
                "status": status,
            },
        }
        for (
            source_id,
            source,
            latitude,
            longitude,
            depth_km,
            magnitude,
            mag_type,
            origin_time,
            place,
            status,
        ) in rows
    ]

    data = {
        "type": "FeatureCollection",
        "features": features,
    }
    with _cache_lock:
        _geojson_cache[cache_key] = (now, data)
        _geojson_cache.move_to_end(cache_key)
        while len(_geojson_cache) > _CACHE_MAX_ENTRIES:
            _geojson_cache.popitem(last=False)
    return data
