from __future__ import annotations

from app.models.database import get_conn


def save_earthquake_event(event) -> int | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO earthquake_events
                    (source_id, source, fingerprint, latitude, longitude,
                     depth_km, magnitude, mag_type, origin_time, place,
                     status, alert_level)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (source_id) DO NOTHING
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


def is_duplicate(source_id: str, fingerprint: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM dedup_cache WHERE key = %s OR key = %s LIMIT 1",
                (f"src:{source_id}", f"fp:{fingerprint}"),
            )
            return cur.fetchone() is not None


def mark_seen(source_id: str, fingerprint: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO dedup_cache (key) VALUES (%s), (%s)
                ON CONFLICT (key) DO NOTHING
                """,
                (f"src:{source_id}", f"fp:{fingerprint}"),
            )


def mark_event_simulated(event_id: int, sim_id: int) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE earthquake_events
                SET sim_triggered = 1, sim_id = %s, updated_at = NOW()
                WHERE id = %s
                """,
                (sim_id, event_id),
            )


def mark_event_sim_failed(event_id: int, error: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE earthquake_events SET sim_triggered = 2, updated_at = NOW() WHERE id = %s",
                (event_id,),
            )


def get_recent_events(limit: int = 50) -> list[dict]:
    import psycopg2.extras

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, source_id, source, latitude, longitude, depth_km,
                       magnitude, mag_type, origin_time, place, status,
                       alert_level, ingested_at, sim_triggered
                FROM earthquake_events
                WHERE origin_time >= NOW() - INTERVAL '1 day'
                ORDER BY origin_time DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]


def get_earthquake_event(event_id: int) -> dict | None:
    import psycopg2.extras

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM earthquake_events WHERE id = %s", (event_id,))
            row = cur.fetchone()
            return dict(row) if row else None


def get_unsimulated_events(minutes: int = 30) -> list[dict]:
    import psycopg2.extras

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM earthquake_events
                WHERE sim_triggered = 0
                  AND ingested_at > NOW() - INTERVAL '1 minute' * %s
                ORDER BY magnitude DESC
                """,
                (minutes,),
            )
            return [dict(row) for row in cur.fetchall()]
