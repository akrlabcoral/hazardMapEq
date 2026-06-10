from __future__ import annotations

from app.models.database import get_conn

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
            return row[0] if row else None


def get_historic_events_geojson() -> dict:
    import psycopg2.extras

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT source_id, source, latitude, longitude, depth_km,
                       magnitude, mag_type, origin_time, place, status
                FROM historic_events
                ORDER BY origin_time DESC
                """
            )
            rows = cur.fetchall()

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row["longitude"], row["latitude"]],
            },
            "properties": {
                "id": row["source_id"],
                "source": row["source"],
                "mag": row["magnitude"],
                "mag_type": row["mag_type"],
                "depth": row["depth_km"],
                "time": row["origin_time"].isoformat(),
                "place": row["place"],
                "status": row["status"]
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }
