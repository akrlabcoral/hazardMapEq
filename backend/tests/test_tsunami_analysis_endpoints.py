from __future__ import annotations

import asyncio

import pytest

from app.core.errors import ValidationError
from app.hazards.tsunami.analysis import run_tsunami_analysis
from app.hazards.tsunami.jobs import analysis_worker
from app.hazards.tsunami.schemas import TsunamiAnalysisRequest, TsunamiSourceModelRequest
from app.hazards.tsunami.service import TsunamiService
from app.main import app


def _analysis_request() -> TsunamiAnalysisRequest:
    return TsunamiAnalysisRequest(
        source_model=TsunamiSourceModelRequest(
            magnitude=8.0,
            latitude=10.0,
            longitude=92.0,
        )
    )


def test_tsunami_analysis_pipeline_contains_all_sections():
    result = run_tsunami_analysis(_analysis_request(), request_id="tsunami:test")

    assert result["hazard_type"] == "tsunami"
    assert result["request_id"] == "tsunami:test"
    assert "source_model" in result
    assert "wave_propagation" in result
    assert "inundation" in result
    assert "damage_assessment" in result
    assert "layers" in result


def test_enqueue_analysis_uses_existing_job_repository_and_manual_queue(monkeypatch):
    created = {}
    enqueued = {}

    class FakeQueue:
        def enqueue(self, func, payload, **kwargs):
            enqueued["func"] = func
            enqueued["payload"] = payload
            enqueued["kwargs"] = kwargs

    monkeypatch.setattr("app.hazards.tsunami.service.create_simulation_job", lambda request_id, payload: created.update({"request_id": request_id, "payload": payload}))
    monkeypatch.setattr("app.hazards.tsunami.service.mark_simulation_job_failed", lambda request_id, error: None)
    monkeypatch.setattr("app.hazards.tsunami.service.redis_manager._is_connected", True)

    service = TsunamiService()
    service._analysis_queue = FakeQueue()

    request_id = asyncio.run(service.enqueue_analysis(_analysis_request()))

    assert request_id.startswith("tsunami:")
    assert created["request_id"] == request_id
    assert created["payload"]["hazard_type"] == "tsunami"
    assert enqueued["payload"]["request_id"] == request_id
    assert enqueued["kwargs"]["job_id"] == request_id


def test_get_analysis_result_returns_existing_job_row(monkeypatch):
    monkeypatch.setattr("app.hazards.tsunami.service.get_simulation_job", lambda request_id: {
        "request_id": request_id,
        "status": "completed",
        "result_json": {"hazard_type": "tsunami"},
        "error": None,
    })

    result = asyncio.run(TsunamiService().get_analysis_result("tsunami:test"))

    assert result["status"] == "completed"
    assert result["result_json"]["hazard_type"] == "tsunami"


def test_layers_extracts_from_completed_result(monkeypatch):
    completed = run_tsunami_analysis(_analysis_request(), request_id="tsunami:test")
    monkeypatch.setattr("app.hazards.tsunami.service.get_simulation_job", lambda request_id: {
        "request_id": request_id,
        "status": "completed",
        "result_json": completed,
        "error": None,
    })

    layers = asyncio.run(TsunamiService().get_analysis_layers("tsunami:test"))

    assert layers["request_id"] == "tsunami:test"
    assert "source_marker" in layers["layers"]
    assert "rupture_polygon" in layers["layers"]
    assert "vertical_deformation_points" in layers["layers"]


def test_layers_conflict_when_job_not_completed(monkeypatch):
    monkeypatch.setattr("app.hazards.tsunami.service.get_simulation_job", lambda request_id: {
        "request_id": request_id,
        "status": "running",
        "result_json": None,
        "error": None,
    })

    with pytest.raises(ValidationError, match="not ready"):
        asyncio.run(TsunamiService().get_analysis_layers("tsunami:test"))


def test_tsunami_worker_marks_job_lifecycle(monkeypatch):
    calls = []

    monkeypatch.setattr(analysis_worker, "init_pool", lambda: calls.append("init"))
    monkeypatch.setattr(analysis_worker, "mark_simulation_job_running", lambda request_id: calls.append(("running", request_id)))
    monkeypatch.setattr(analysis_worker, "mark_simulation_job_completed", lambda request_id, result: calls.append(("completed", request_id, result["hazard_type"])))
    monkeypatch.setattr(analysis_worker, "mark_simulation_job_failed", lambda request_id, error: calls.append(("failed", request_id, error)))
    monkeypatch.setattr(analysis_worker, "run_tsunami_analysis", lambda request, request_id=None: {
        "request_id": request_id,
        "hazard_type": "tsunami",
        "layers": {},
    })

    result = analysis_worker.run_tsunami_analysis_job({
        "request_id": "tsunami:test",
        "request": _analysis_request().model_dump(mode="json"),
    })

    assert result == {"request_id": "tsunami:test", "hazard_type": "tsunami"}
    assert calls[0] == "init"
    assert ("running", "tsunami:test") in calls
    assert ("completed", "tsunami:test", "tsunami") in calls


def test_tsunami_analysis_routes_are_registered():
    paths = {getattr(route, "path", "") for route in app.routes}

    assert "/api/hazards/tsunami/analyze" in paths
    assert "/api/hazards/tsunami/result/{request_id}" in paths
    assert "/api/hazards/tsunami/layers/{request_id}" in paths
    assert "/api/hazards/tsunami/calculate" in paths
    assert "/api/hazards/tsunami/source-model" in paths
    assert "/api/hazards/tsunami/wave-propagation" in paths
    assert "/api/hazards/tsunami/inundation" in paths
    assert "/api/hazards/tsunami/damage-assessment" in paths
