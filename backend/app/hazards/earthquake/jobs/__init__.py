"""Earthquake job facade."""
from __future__ import annotations

from app.hazards.earthquake.jobs.queue import SimulationQueue, enqueue, get_queue
from app.hazards.earthquake.jobs.simulation_worker import SimulationRunner

__all__ = ["SimulationQueue", "SimulationRunner", "enqueue", "get_queue"]
