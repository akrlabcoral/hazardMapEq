import json
import logging
import threading
import time

import redis
from rq import get_current_job

from app.config import settings
from app.jobs.simulation_worker import SimulationRunner
from app.models.repository import init_pool, mark_event_sim_failed, mark_event_simulated
from app.models.simulation_job_repository import (
    mark_simulation_job_completed,
    mark_simulation_job_failed,
    mark_simulation_job_running,
)
from app.soil.loader import load_all_soil_rasters

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("hazardmap.rq_worker")


_worker_ready = False
_worker_ready_lock = threading.Lock()
_redis_pub = None


def _get_redis_pub() -> redis.Redis:
    global _redis_pub
    if _redis_pub is None:
        _redis_pub = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
        )
    return _redis_pub


def _ensure_worker_ready() -> None:
    global _worker_ready
    if _worker_ready:
        return

    with _worker_ready_lock:
        if _worker_ready:
            return

        started = time.perf_counter()
        logger.info("[RQ] Initializing worker resources...")
        init_pool()
        load_all_soil_rasters()
        SimulationRunner.initialize_default()
        _worker_ready = True
        logger.info("[RQ] Worker resources ready in %.0fms.", (time.perf_counter() - started) * 1000)


def _publish(topic: str, message: dict) -> None:
    contract_payload = {
        "version": "1.0",
        "timestamp": time.time(),
        "payload": message
    }
    _get_redis_pub().publish(topic, json.dumps(contract_payload, default=str))


def _mark_success(event: dict, result: dict) -> None:
    if event.get("kind") != "manual" and event.get("db_id") is not None:
        mark_event_simulated(event["db_id"], result["simulation_id"])

def _mark_failure(event: dict, error: str) -> None:
    if event.get("kind") != "manual" and event.get("db_id") is not None:
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
    job_started = time.perf_counter()
    enqueued_at = event_dict.get("enqueued_at")
    queue_wait_ms = (time.time() - enqueued_at) * 1000 if isinstance(enqueued_at, (int, float)) else None
    logger.info(
        "[RQ] Starting simulation job for %s queue_wait_ms=%s",
        event_dict.get("source_id"),
        round(queue_wait_ms) if queue_wait_ms is not None else "unknown",
    )
    _ensure_worker_ready()
    request_id = event_dict.get("request_id") or event_dict.get("source_id")
    is_manual = event_dict.get("kind") == "manual"
    if is_manual:
        t_status = time.perf_counter()
        mark_simulation_job_running(request_id)
        logger.info("[RQTiming] mark_running_ms=%.0f request_id=%s", (time.perf_counter() - t_status) * 1000, request_id)
    
    # Broadcast "running"
    t_publish_running = time.perf_counter()
    _publish("ws_events", {
        "type": "simulation_running",
        "request_id": request_id,
        "event": event_dict,
        "triggered_by": "manual" if is_manual else "auto",
    })
    logger.info(
        "[RQTiming] publish_running_ms=%.0f request_id=%s",
        (time.perf_counter() - t_publish_running) * 1000,
        request_id,
    )

    try:
        triggered_by = (
            "manual"
            if is_manual
            else f"auto_{event_dict.get('source')}" if event_dict.get('source') else "auto_unknown"
        )
        
        # Heavy ML Matplotlib work is fully safe to run here
        t_sim = time.perf_counter()
        result = SimulationRunner.run(
            latitude=event_dict["latitude"],
            longitude=event_dict["longitude"],
            magnitude=event_dict["magnitude"],
            depth_km=event_dict["depth_km"],
            gmpe_params=event_dict.get("gmpe_params") if is_manual else None,
            event_id=event_dict.get("db_id"),
            triggered_by=triggered_by
        )
        logger.info("[RQTiming] simulation_run_ms=%.0f request_id=%s", (time.perf_counter() - t_sim) * 1000, request_id)
        result["request_id"] = request_id
        
        t_mark_success = time.perf_counter()
        _mark_success(event_dict, result)
        logger.info("[RQTiming] mark_event_success_ms=%.0f request_id=%s", (time.perf_counter() - t_mark_success) * 1000, request_id)
        if is_manual:
            t_completed = time.perf_counter()
            mark_simulation_job_completed(request_id, result)
            logger.info("[RQTiming] mark_job_completed_ms=%.0f request_id=%s", (time.perf_counter() - t_completed) * 1000, request_id)

        t_publish_complete = time.perf_counter()
        completion_message = {
            "type": "simulation_complete",
            "request_id": request_id,
            "triggered_by": triggered_by,
            "event": event_dict,
            "simulation_id": result.get("simulation_id"),
            "event_id": event_dict.get("db_id"),
        }
        if not is_manual:
            completion_message["simulation"] = result

        _publish("ws_events", {
            **completion_message,
        })
        logger.info(
            "[RQTiming] publish_complete_ms=%.0f total_job_ms=%.0f request_id=%s",
            (time.perf_counter() - t_publish_complete) * 1000,
            (time.perf_counter() - job_started) * 1000,
            request_id,
        )

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
            if is_manual:
                mark_simulation_job_failed(request_id, str(exc))
            _publish("ws_events", {
                "type": "simulation_error",
                "request_id": request_id,
                "triggered_by": "manual" if is_manual else "auto",
                "event": event_dict,
                "error": str(exc)
            })
        raise exc
