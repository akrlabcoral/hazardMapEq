"""
app/models/repository.py

PostgreSQL persistence layer using psycopg2 ThreadedConnectionPool.

Connection strategy:
  - ThreadedConnectionPool keeps N persistent connections ready.
  - Each FastAPI thread borrows a connection, runs its query, returns it.
  - This is safe, efficient, and works with uvicorn's thread-pool model.

Environment variable:
  DATABASE_URL = postgresql://user:password@host:5432/dbname
  (set in docker-compose.yml → passed into the container automatically)
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

logger = logging.getLogger("hazardmap.repository")

# ---------------------------------------------------------------------------
# Connection pool — created once at module import
# ---------------------------------------------------------------------------
_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://hazardmap:hazardmap_dev@localhost:5432/hazardmap",
)

# min=2 connections always ready, max=10 for burst traffic
_pool: ThreadedConnectionPool = ThreadedConnectionPool(
    minconn=2,
    maxconn=10,
    dsn=_DATABASE_URL,
)


@contextmanager
def _get_conn():
    """
    Context manager that borrows a connection from the pool,
    yields it, then returns it — even on exception.

    Usage:
        with _get_conn() as conn:
            conn.execute(...)
    """
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


# ---------------------------------------------------------------------------
# Schema Initialization
# ---------------------------------------------------------------------------
def init_db() -> None:
    """Create all tables if they don't exist. Called once at startup."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            # Main simulations table
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

            # Earthquake events table (for future real-time ingestion)
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

            # Deduplication cache (for real-time feed ingestion)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS dedup_cache (
                    key         TEXT PRIMARY KEY,
                    seen_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Indexes
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

            # Migration: add sim_id FK column if it doesn't already exist
            # (safe to run on every startup — IF NOT EXISTS guard prevents duplicates)
            cur.execute("""
                ALTER TABLE earthquake_events
                ADD COLUMN IF NOT EXISTS sim_id INTEGER DEFAULT NULL
            """)


# ---------------------------------------------------------------------------
# Simulations CRUD
# ---------------------------------------------------------------------------
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
    """Persist a simulation and return its auto-assigned ID."""
    with _get_conn() as conn:
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
                    json.dumps(district_summary),
                    json.dumps(grid_geojson) if grid_geojson is not None else None,
                    event_id,
                    triggered_by,
                ),
            )
            return cur.fetchone()[0]


# ---------------------------------------------------------------------------
# Earthquake Events CRUD
# ---------------------------------------------------------------------------
def save_earthquake_event(event) -> int:
    """
    Insert a new earthquake event into `earthquake_events`.
    Returns the auto-assigned id.
    Accepts an EarthquakeEvent dataclass instance.
    """
    with _get_conn() as conn:
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
    """Check dedup_cache for source_id OR fingerprint. Returns True if either is seen."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM dedup_cache WHERE key = %s OR key = %s LIMIT 1",
                (f"src:{source_id}", f"fp:{fingerprint}"),
            )
            return cur.fetchone() is not None


def mark_seen(source_id: str, fingerprint: str) -> None:
    """Insert source_id and fingerprint keys into dedup_cache."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO dedup_cache (key) VALUES (%s), (%s)
                ON CONFLICT (key) DO NOTHING
                """,
                (f"src:{source_id}", f"fp:{fingerprint}"),
            )


def mark_event_simulated(event_id: int, sim_id: int) -> None:
    """Mark an earthquake event as successfully simulated and store the linked sim_id."""
    with _get_conn() as conn:
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
    """Mark an earthquake event simulation as failed (sim_triggered = 2)."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE earthquake_events SET sim_triggered = 2, updated_at = NOW() WHERE id = %s",
                (event_id,),
            )


def get_recent_events(limit: int = 50) -> list[dict]:
    """Return N most recent earthquake events, newest first."""
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, source_id, source, latitude, longitude, depth_km,
                       magnitude, mag_type, origin_time, place, status,
                       alert_level, ingested_at, sim_triggered
                FROM earthquake_events
                ORDER BY origin_time DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]


def get_earthquake_event(event_id: int) -> dict | None:
    """Return a single earthquake event by ID."""
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM earthquake_events WHERE id = %s",
                (event_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_unsimulated_events(minutes: int = 30) -> list[dict]:
    """For startup recovery — events ingested recently that weren't simulated yet."""
    with _get_conn() as conn:
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


# ---------------------------------------------------------------------------
# Cleanup (run as a daily task)
# ---------------------------------------------------------------------------
def cleanup_old_data() -> None:
    """
    Drop GeoJSON blobs older than 30 days (keep metadata).
    Delete earthquake_events older than 90 days.
    Purge dedup_cache older than 24 hours.
    """
    with _get_conn() as conn:
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


# ---------------------------------------------------------------------------
# Pool shutdown (called from main.py lifespan on shutdown)
# ---------------------------------------------------------------------------
def close_pool() -> None:
    """Close all connections in the pool gracefully."""
    _pool.closeall()
    logger.info("[DB] Connection pool closed.")


# ---------------------------------------------------------------------------
# Initialize schema when module is first imported
# ---------------------------------------------------------------------------
init_db()
