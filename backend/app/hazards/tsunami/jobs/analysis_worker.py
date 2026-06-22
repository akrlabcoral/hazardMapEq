from __future__ import annotations

import logging
import time

from app.core.logging import configure_logging
from app.hazards.tsunami.analysis import run_tsunami_analysis
from app.hazards.tsunami.schemas import TsunamiAnalysisRequest
from app.models.repository import init_pool
from app.models.simulation_job_repository import (
    mark_simulation_job_completed,
    mark_simulation_job_failed,
    mark_simulation_job_running,
)

configure_logging(logging.INFO)
logger = logging.getLogger("hazardmap.tsunami.analysis_worker")


def run_tsunami_analysis_job(payload: dict) -> dict:
    started = time.perf_counter()
    request_id = payload["request_id"]
    try:
        init_pool()
        mark_simulation_job_running(request_id)
        request = TsunamiAnalysisRequest.model_validate(payload["request"])
        result = run_tsunami_analysis(request, request_id=request_id)
        mark_simulation_job_completed(request_id, result)
        logger.info(
            "[TsunamiAnalysis] completed request_id=%s elapsed_ms=%.0f",
            request_id,
            (time.perf_counter() - started) * 1000,
        )
        return {"request_id": request_id, "hazard_type": "tsunami"}
    except Exception as exc:
        logger.exception("[TsunamiAnalysis] failed request_id=%s", request_id)
        try:
            mark_simulation_job_failed(request_id, str(exc))
        except Exception:
            logger.exception("[TsunamiAnalysis] could not mark failure request_id=%s", request_id)
        raise
