from __future__ import annotations

from app.models.database import get_conn
from app.models.historic_repository import clear_historic_cache


def cleanup_old_data() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE simulations
                SET grid_geojson_json = NULL
                WHERE timestamp < NOW() - INTERVAL '30 days'
                  AND grid_geojson_json IS NOT NULL
            """)
            cur.execute("""
                INSERT INTO historic_events
                    (source_id, source, fingerprint, latitude, longitude,
                     depth_km, magnitude, mag_type, origin_time, place,
                     status, alert_level, ingested_at, updated_at)
                SELECT source_id, source, fingerprint, latitude, longitude,
                       depth_km, magnitude, mag_type, origin_time, place,
                       status, alert_level, ingested_at, updated_at
                FROM earthquake_events
                WHERE origin_time < NOW() - INTERVAL '1 day'
                  AND magnitude >= 4.0
                ON CONFLICT (source_id) DO NOTHING
            """)
            cur.execute("""
                DELETE FROM earthquake_events
                WHERE origin_time < NOW() - INTERVAL '1 day'
            """)
            cur.execute("""
                DELETE FROM dedup_cache
                WHERE seen_at < NOW() - INTERVAL '1 day'
            """)
    clear_historic_cache()
