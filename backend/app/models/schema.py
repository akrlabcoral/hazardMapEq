from __future__ import annotations

from app.models.database import get_conn


def init_db() -> None:
    """Create all tables and compatible additive migrations."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS simulations (
                    id                      SERIAL PRIMARY KEY,
                    timestamp               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    latitude                REAL    NOT NULL,
                    longitude               REAL    NOT NULL,
                    magnitude               REAL    NOT NULL,
                    depth                   REAL    NOT NULL,
                    affected_districts_json JSONB   NOT NULL DEFAULT '[]'::jsonb,
                    grid_geojson_json       JSONB   DEFAULT NULL,
                    event_id                INTEGER DEFAULT NULL,
                    triggered_by            TEXT    DEFAULT 'manual'
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS earthquake_events (
                    id              SERIAL PRIMARY KEY,
                    source_id       TEXT NOT NULL UNIQUE,
                    source          TEXT NOT NULL,
                    fingerprint     TEXT NOT NULL UNIQUE,
                    latitude        REAL NOT NULL,
                    longitude       REAL NOT NULL,
                    depth_km        REAL NOT NULL,
                    magnitude       REAL NOT NULL,
                    mag_type        TEXT DEFAULT 'Mw',
                    origin_time     TIMESTAMP NOT NULL,
                    place           TEXT,
                    status          TEXT DEFAULT 'automatic',
                    alert_level     TEXT,
                    ingested_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    sim_triggered   SMALLINT DEFAULT 0
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS dedup_cache (
                    key         TEXT PRIMARY KEY,
                    seen_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_simulations_timestamp
                ON simulations(timestamp DESC)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_events_origin_time
                ON earthquake_events(origin_time DESC)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_events_magnitude
                ON earthquake_events(magnitude DESC)
            """)
            cur.execute("""
                ALTER TABLE earthquake_events
                ADD COLUMN IF NOT EXISTS sim_id INTEGER DEFAULT NULL
            """)
