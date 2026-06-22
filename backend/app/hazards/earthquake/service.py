"""Earthquake hazard service layer."""
from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Any

from pydantic import BaseModel

from app.api.ws import client_count
from app.core.errors import NotFoundError, ServiceUnavailableError, ValidationError
from app.hazards.base.interfaces import HazardService
from app.hazards.earthquake import repository
from app.hazards.earthquake.ingest import poller_stats
from app.hazards.earthquake.jobs import get_queue
from app.hazards.earthquake.schemas import EarthquakeInput
from app.shared.reports.basic import build_hazard_report
from app.shared.gis.boundary import is_epicenter_valid

logger = logging.getLogger(__name__)


class EarthquakeService(HazardService):
    hazard_type = "earthquake"

    def validate_input(self, input_data: Any) -> EarthquakeInput:
        try:
            if isinstance(input_data, EarthquakeInput):
                validated = input_data
            else:
                validated = EarthquakeInput.model_validate(input_data)
            self.validate_epicenter(validated.latitude, validated.longitude)
            return validated
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    async def run_analysis(self, validated_data: Any, **kwargs: Any) -> dict[str, Any]:
        request = self.validate_input(validated_data)
        request_id = await self.enqueue_manual_simulation(
            latitude=request.latitude,
            longitude=request.longitude,
            magnitude=request.magnitude,
            depth_km=request.depth,
        )
        return {
            "status": "accepted",
            "request_id": request_id,
            "message": "Simulation queued. Listen for simulation_complete over WebSocket.",
        }

    def generate_layers(self, result: Any) -> dict[str, Any]:
        if isinstance(result, dict):
            return {
                "grid_geojson": result.get("grid_geojson"),
                "contour_geojson": result.get("contour_geojson"),
                "intensity_contour_geojson": result.get("intensity_contour_geojson"),
            }
        return {}

    def generate_report(self, result: Any) -> dict[str, Any]:
        serialized = self.serialize_result(result)
        return build_hazard_report(
            hazard_type=self.hazard_type,
            result=serialized,
            summary={
                "simulation_id": serialized.get("simulation_id"),
                "event_id": serialized.get("event_id"),
                "triggered_by": serialized.get("triggered_by"),
            },
        )

    def serialize_result(self, result: Any) -> dict[str, Any]:
        if isinstance(result, BaseModel):
            return result.model_dump(mode="json")
        if isinstance(result, dict):
            return result
        return {"result": result}

    def list_events(self, limit: int = 50, region: str | None = None) -> dict[str, Any]:
        events = repository.get_recent_events(limit=limit)
        if region and region.lower() == "india":
            events = [event for event in events if is_epicenter_valid(event["latitude"], event["longitude"])]
        return {"events": events, "count": len(events)}

    def get_event(self, event_id: int) -> dict[str, Any]:
        event = repository.get_earthquake_event(event_id)
        if event is None:
            raise NotFoundError(f"Event {event_id} not found")
        return event

    def get_health(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "poller": poller_stats,
            "queue_depth": get_queue().qsize(),
            "ws_clients": client_count(),
            "db": "postgresql",
        }

    def get_historic_events(
        self,
        *,
        min_magnitude: float | None = None,
        limit: int | None = None,
        bbox: str | None = None,
    ) -> dict[str, Any]:
        try:
            return repository.get_historic_events_geojson(
                min_magnitude=min_magnitude,
                limit=limit,
                bbox=bbox,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    def historic_etag(self, data: dict[str, Any]) -> str:
        digest = hashlib.sha1()
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            digest.update(str(props.get("id", "")).encode())
            digest.update(str(props.get("time", "")).encode())
            digest.update(str(props.get("mag", "")).encode())
            digest.update(str(props.get("depth", "")).encode())
            digest.update(str(props.get("place", "")).encode())
        return f'W/"historic-{len(data.get("features", []))}-{digest.hexdigest()}"'

    def validate_epicenter(self, latitude: float, longitude: float) -> None:
        if not is_epicenter_valid(latitude, longitude):
            raise ValidationError(
                "Epicenter is outside the supported region. "
                "HazardMap covers India and a ~1000 km buffer zone around it."
            )

    async def enqueue_manual_simulation(
        self,
        *,
        latitude: float,
        longitude: float,
        magnitude: float,
        depth_km: float,
    ) -> str:
        self.validate_epicenter(latitude, longitude)
        try:
            return await asyncio.to_thread(
                get_queue().enqueue_manual,
                latitude=latitude,
                longitude=longitude,
                magnitude=magnitude,
                depth_km=depth_km,
            )
        except Exception as exc:
            logger.exception("Failed to enqueue manual earthquake simulation")
            raise ServiceUnavailableError(str(exc)) from exc

    async def get_simulation_status(self, request_id: str) -> dict[str, Any]:
        job = await asyncio.to_thread(repository.get_simulation_job, request_id)
        if job is None:
            raise NotFoundError("Simulation request not found")
        return job


earthquake_service = EarthquakeService()
