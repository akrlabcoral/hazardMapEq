from __future__ import annotations

from app.models.database import get_conn


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
                DELETE FROM earthquake_events
                WHERE ingested_at < NOW() - INTERVAL '90 days'
            """)
            cur.execute("""
                DELETE FROM dedup_cache
                WHERE seen_at < NOW() - INTERVAL '1 day'
            """)
