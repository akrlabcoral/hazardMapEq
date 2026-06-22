from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import redis
from rq import Queue, Retry
from pydantic import BaseModel

from app.core.errors import NotFoundError, ServiceUnavailableError, ValidationError
from app.hazards.base.interfaces import HazardService
from app.hazards.tsunami.analysis import extract_tsunami_layers
from app.hazards.tsunami.calculator import calculate_tsunami_hazard
from app.hazards.tsunami.damage.estimator import DamageAssessmentInput, TsunamiDamageEstimator
from app.hazards.tsunami.jobs.analysis_worker import run_tsunami_analysis_job
from app.hazards.tsunami.models.inundation_engine import InundationEngine, InundationInput
from app.hazards.tsunami.models.okada_model import OkadaSourceModel, SourceModelInput
from app.hazards.tsunami.models.wave_engine import WavePropagationEngine, WavePropagationInput
from app.hazards.tsunami.schemas import (
    TsunamiAnalysisRequest,
    TsunamiCalculationRequest,
    TsunamiCalculationResponse,
    TsunamiDamageAssessmentRequest,
    TsunamiDamageAssessmentResponse,
    TsunamiInundationRequest,
    TsunamiInundationResponse,
    TsunamiSourceModelRequest,
    TsunamiSourceModelResponse,
    TsunamiWavePropagationRequest,
    TsunamiWavePropagationResponse,
)
from app.models.simulation_job_repository import create_simulation_job, get_simulation_job, mark_simulation_job_failed
from app.shared.gis.bathymetry_service import bathymetry_service
from app.shared.gis.coastline_service import coastline_service
from app.shared.reports.basic import build_hazard_report
from app.services.redis_client import redis_manager

logger = logging.getLogger(__name__)
TSUNAMI_ANALYSIS_QUEUE_NAME = "hazard_manual"


class TsunamiService(HazardService):
    hazard_type = "tsunami"

    def __init__(
        self,
        source_model: OkadaSourceModel | None = None,
        wave_engine: WavePropagationEngine | None = None,
        inundation_engine: InundationEngine | None = None,
        damage_estimator: TsunamiDamageEstimator | None = None,
    ) -> None:
        self.source_model = source_model or OkadaSourceModel()
        self.wave_engine = wave_engine or WavePropagationEngine(source_model=self.source_model)
        self.inundation_engine = inundation_engine or InundationEngine()
        self.damage_estimator = damage_estimator or TsunamiDamageEstimator()
        self._redis_conn = None
        self._analysis_queue = None

    def validate_input(self, input_data: Any) -> TsunamiCalculationRequest:
        try:
            if isinstance(input_data, TsunamiCalculationRequest):
                return input_data
            return TsunamiCalculationRequest.model_validate(input_data)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    def run_analysis(self, validated_data: Any, **kwargs: Any) -> TsunamiCalculationResponse:
        return self.calculate(self.validate_input(validated_data))

    def generate_layers(self, result: Any) -> dict[str, Any]:
        serialized = self.serialize_result(result)
        inputs = serialized.get("inputs", {})
        latitude = inputs.get("latitude")
        longitude = inputs.get("longitude")
        if latitude is None or longitude is None:
            return {}
        return {
            "source_marker": {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                "properties": {
                    "hazard_type": self.hazard_type,
                    "potential": serialized.get("tsunami_potential_class", {}).get("level"),
                },
            }
        }

    def generate_report(self, result: Any) -> dict[str, Any]:
        serialized = self.serialize_result(result)
        return build_hazard_report(
            hazard_type=self.hazard_type,
            result=serialized,
            summary={
                "potential": serialized.get("tsunami_potential_class", {}).get("level"),
                "speed_kmh": serialized.get("tsunami_speed_kmh"),
                "estimated_runup_m": serialized.get("estimated_runup_m"),
            },
        )

    def serialize_result(self, result: Any) -> dict[str, Any]:
        if isinstance(result, BaseModel):
            return result.model_dump(mode="json")
        if isinstance(result, dict):
            return result
        return {"result": result}

    def calculate(self, request: TsunamiCalculationRequest) -> TsunamiCalculationResponse:
        validated = self.validate_input(request)
        if validated.latitude is not None and validated.longitude is not None:
            bathymetry_service.sample_depth_m(validated.longitude, validated.latitude)
            coastline_service.get_geometry()
        return TsunamiCalculationResponse.model_validate(calculate_tsunami_hazard(validated))

    def model_source(self, request: TsunamiSourceModelRequest) -> TsunamiSourceModelResponse:
        result = self.source_model.model(SourceModelInput(**request.model_dump()))
        return TsunamiSourceModelResponse.model_validate({
            **result.to_dict(),
            "inputs": request,
        })

    def propagate_wave(self, request: TsunamiWavePropagationRequest) -> TsunamiWavePropagationResponse:
        result = self.wave_engine.propagate(WavePropagationInput(**request.model_dump()))
        return TsunamiWavePropagationResponse.model_validate({
            **result.to_dict(),
            "inputs": request,
        })

    def model_inundation(self, request: TsunamiInundationRequest) -> TsunamiInundationResponse:
        result = self.inundation_engine.model(InundationInput(**request.model_dump()))
        return TsunamiInundationResponse.model_validate({
            **result.to_dict(),
            "inputs": request,
        })

    def assess_damage(self, request: TsunamiDamageAssessmentRequest) -> TsunamiDamageAssessmentResponse:
        result = self.damage_estimator.assess(DamageAssessmentInput(**request.model_dump()))
        return TsunamiDamageAssessmentResponse.model_validate({
            **result.to_dict(),
            "inputs": request,
        })

    async def enqueue_analysis(self, request: TsunamiAnalysisRequest) -> str:
        return await asyncio.to_thread(self._enqueue_analysis_sync, request)

    async def get_analysis_result(self, request_id: str) -> dict[str, Any]:
        job = await asyncio.to_thread(get_simulation_job, request_id)
        if job is None:
            raise NotFoundError("Tsunami analysis request not found")
        return job

    async def get_analysis_layers(self, request_id: str) -> dict[str, Any]:
        job = await self.get_analysis_result(request_id)
        if job.get("status") != "completed":
            raise ValidationError("Tsunami analysis result is not ready")
        result = job.get("result_json") or {}
        if result.get("hazard_type") != "tsunami":
            raise NotFoundError("Tsunami analysis result not found")
        return {
            "request_id": request_id,
            "status": job["status"],
            "layers": result.get("layers") or extract_tsunami_layers(result),
            "metadata": result.get("metadata") or {},
        }

    def _enqueue_analysis_sync(self, request: TsunamiAnalysisRequest) -> str:
        if not redis_manager._is_connected:
            raise ServiceUnavailableError("Redis is unavailable; tsunami analysis job was not queued.")

        request_id = f"tsunami:{uuid.uuid4().hex}"
        payload = {
            "kind": "tsunami_analysis",
            "hazard_type": "tsunami",
            "request_id": request_id,
            "request": request.model_dump(mode="json"),
        }

        try:
            create_simulation_job(request_id, payload)
            queue = self._get_analysis_queue()
            queue.enqueue(
                run_tsunami_analysis_job,
                payload,
                job_id=request_id,
                job_timeout=300,
                result_ttl=0,
                failure_ttl=86400,
                ttl=3600,
                retry=Retry(max=1, interval=[30]),
            )
            return request_id
        except Exception as exc:
            logger.exception("Failed to enqueue tsunami analysis request")
            try:
                mark_simulation_job_failed(request_id, str(exc))
            except Exception:
                logger.exception("Could not mark tsunami analysis %s as failed.", request_id)
            raise ServiceUnavailableError(str(exc)) from exc

    def _get_analysis_queue(self) -> Queue:
        if self._analysis_queue is None:
            if self._redis_conn is None:
                self._redis_conn = redis.Redis.from_url(redis_manager.url)
            self._analysis_queue = Queue(TSUNAMI_ANALYSIS_QUEUE_NAME, connection=self._redis_conn)
        return self._analysis_queue


tsunami_service = TsunamiService()
