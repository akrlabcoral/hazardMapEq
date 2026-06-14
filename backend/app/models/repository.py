"""
Compatibility facade for the refactored persistence layer.

Existing API/job modules can keep importing from app.models.repository while
the implementation lives in focused modules.
"""
from __future__ import annotations

from app.models.cleanup_repository import cleanup_old_data
from app.models.database import close_pool, get_conn as _get_conn, init_pool
from app.models.event_repository import (
    get_earthquake_event,
    get_recent_events,
    get_unsimulated_events,
    is_duplicate,
    mark_event_sim_failed,
    mark_event_simulated,
    mark_seen,
    save_earthquake_event,
    try_mark_seen,
)
from app.models.schema import init_db
from app.models.simulation_repository import save_simulation

__all__ = [
    "_get_conn",
    "init_pool",
    "init_db",
    "save_simulation",
    "save_earthquake_event",
    "is_duplicate",
    "mark_seen",
    "try_mark_seen",
    "mark_event_simulated",
    "mark_event_sim_failed",
    "get_recent_events",
    "get_earthquake_event",
    "get_unsimulated_events",
    "cleanup_old_data",
    "close_pool",
]
