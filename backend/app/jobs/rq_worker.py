import asyncio
import logging
import time

from rq import get_current_job

from app.jobs.simulation_worker import SimulationRunner
from app.models.repository import init_db, init_pool, mark_event_sim_failed, mark_event_simulated
from app.services.redis_client import redis_manager
from app.soil.loader import load_all_soil_rasters

logger = logging.getLogger("hazardmap.rq_worker")

_worker_ready = False


def _ensure_worker_ready() -> None:
    global _worker_ready
    if _worker_ready:
        return

    logger.info("[RQ] Initializing worker resources...")
    init_pool()
    init_db()
    load_all_soil_rasters()
    SimulationRunner.initialize_default()
    _worker_ready = True
    logger.info("[RQ] Worker resources ready.")


async def _publish_async(topic: str, message: dict):
    # Ensure Redis is connected before publishing from the worker process
    if not redis_manager._is_connected:
        await redis_manager.connect()
    
    contract_payload = {
        "version": "1.0",
        "timestamp": time.time(),
        "payload": message
    }
    await redis_manager.publish(topic, contract_payload)


def _mark_success(event: dict, result: dict) -> None:
    if event.get("db_id") is not None:
        mark_event_simulated(event["db_id"], result["simulation_id"])

def _mark_failure(event: dict, error: str) -> None:
    if event.get("db_id") is not None:
        mark_event_sim_failed(event["db_id"], error)


def _retries_remaining() -> int:
    job = get_current_job()
    if job is None:
        return 0
    return int(getattr(job, "retries_left", 0) or 0)


def run_simulation_job(event_dict: dict) -> dict:
    """
    RQ entrypoint. 
    Runs completely decoupled from the FastAPI event loop.
    We receive a dict because EarthquakeEvent might not serialize well natively.
    """
    logger.info(f"[RQ] Starting simulation job for {event_dict.get('source_id')}")
    _ensure_worker_ready()
    
    # Broadcast "running"
    asyncio.run(_publish_async("ws_events", {
        "type": "simulation_running",
        "event": event_dict
    }))

    try:
        triggered_by = f"auto_{event_dict.get('source')}" if event_dict.get('source') else "auto_unknown"
        
        # Heavy ML Matplotlib work is fully safe to run here
        result = SimulationRunner.run(
            latitude=event_dict["latitude"],
            longitude=event_dict["longitude"],
            magnitude=event_dict["magnitude"],
            depth_km=event_dict["depth_km"],
            gmpe_params=None,
            event_id=event_dict.get("db_id"),
            triggered_by=triggered_by
        )
        
        _mark_success(event_dict, result)

        asyncio.run(_publish_async("ws_events", {
            "type": "simulation_complete",
            "event": event_dict,
            "simulation": result
        }))

        logger.info(f"[RQ] Job complete for {event_dict.get('source_id')}")
        return {
            "simulation_id": result["simulation_id"],
            "event_id": event_dict.get("db_id"),
        }

    except Exception as exc:
        logger.exception(f"[RQ] Job failed for {event_dict.get('source_id')}: {exc}")
        if _retries_remaining() > 0:
            logger.info(
                "[RQ] Job for %s will be retried; retries_remaining=%d",
                event_dict.get("source_id"),
                _retries_remaining(),
            )
        else:
            _mark_failure(event_dict, str(exc))
            asyncio.run(_publish_async("ws_events", {
                "type": "simulation_error",
                "event": event_dict,
                "error": str(exc)
            }))
        raise exc
