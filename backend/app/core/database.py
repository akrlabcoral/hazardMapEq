"""Core database compatibility module."""
from __future__ import annotations

from app.models.database import close_pool, get_conn, init_pool
from app.models.schema import init_db

__all__ = ["close_pool", "get_conn", "init_db", "init_pool"]

