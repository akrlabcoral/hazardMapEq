"""
Database lifecycle and connection access.

The connection pool is initialized from FastAPI lifespan startup instead of at
module import time. This keeps imports safe in tests and scripts.
"""
from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import TYPE_CHECKING, Iterator

if TYPE_CHECKING:
    from psycopg2.pool import ThreadedConnectionPool

from app.config import settings

logger = logging.getLogger("hazardmap.database")

_pool: "ThreadedConnectionPool | None" = None


def init_pool(
    database_url: str | None = None,
    minconn: int | None = None,
    maxconn: int | None = None,
) -> None:
    global _pool
    if _pool is not None:
        return

    dsn = database_url or settings.database_url
    if not dsn:
        raise RuntimeError("Required env var 'DATABASE_URL' is not set.")

    from psycopg2.pool import ThreadedConnectionPool

    _pool = ThreadedConnectionPool(
        minconn=minconn or settings.db_min_connections,
        maxconn=maxconn or settings.db_max_connections,
        dsn=dsn,
    )
    logger.info("[DB] Connection pool initialized.")


def ensure_pool() -> "ThreadedConnectionPool":
    if _pool is None:
        raise RuntimeError("Database pool is not initialized. Call init_pool() during app startup first.")
    return _pool


@contextmanager
def get_conn() -> Iterator["connection"]:
    pool = ensure_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def close_pool() -> None:
    global _pool
    if _pool is None:
        return
    _pool.closeall()
    _pool = None
    logger.info("[DB] Connection pool closed.")
