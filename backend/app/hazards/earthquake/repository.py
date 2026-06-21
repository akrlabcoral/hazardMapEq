"""Earthquake repository facade.

This module gives the earthquake hazard package a stable repository boundary
without changing the existing SQL/table layout.
"""
from __future__ import annotations

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
from app.models.historic_repository import (
    clear_historic_cache,
    get_historic_events_geojson,
    save_historic_event,
    save_historic_events_batch,
)
from app.models.simulation_job_repository import get_simulation_job

__all__ = [
    "clear_historic_cache",
    "get_earthquake_event",
    "get_historic_events_geojson",
    "get_recent_events",
    "get_simulation_job",
    "get_unsimulated_events",
    "is_duplicate",
    "mark_event_sim_failed",
    "mark_event_simulated",
    "mark_seen",
    "save_earthquake_event",
    "save_historic_event",
    "save_historic_events_batch",
    "try_mark_seen",
]

