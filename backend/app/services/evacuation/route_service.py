from __future__ import annotations

import asyncio
from typing import Any

from app.core.errors import NotFoundError
from app.services.evacuation.hospital_service import fetch_hospitals, hospitals_geojson
from app.services.evacuation.osrm_client import OsrmClient
from app.services.evacuation.schemas import (
    Coordinate,
    DirectionStep,
    EvacuationPlanRequest,
    EvacuationPlanResponse,
    EvacuationRouteRequest,
    Hospital,
    NearestHospitalRequest,
    NearestHospitalResponse,
    RouteResponse,
    RouteSummary,
)


def _steps(route: dict[str, Any]) -> list[DirectionStep]:
    result = []
    for leg in route.get("legs", []):
        for step in leg.get("steps", []):
            maneuver = step.get("maneuver") or {}
            road = step.get("name") or step.get("ref") or "Unnamed road"
            result.append(DirectionStep(
                instruction=_instruction(maneuver.get("type", ""), maneuver.get("modifier", ""), road),
                road=road,
                distance_m=round(float(step.get("distance") or 0)),
                duration_s=round(float(step.get("duration") or 0)),
                type=maneuver.get("type", ""),
                modifier=maneuver.get("modifier", "") or "",
            ))
    return result


def _instruction(kind: str, modifier: str, road: str) -> str:
    if kind == "depart":
        return f"Start on {road}"
    if kind == "arrive":
        return "Arrive at destination"
    if kind == "turn":
        return f"{modifier.capitalize() or 'Turn'} onto {road}"
    if kind == "merge":
        return f"Merge onto {road}"
    if kind in {"roundabout", "rotary"}:
        return f"Enter roundabout, exit onto {road}"
    return f"Continue on {road}"


def _route_geojson(routes: list[dict[str, Any]], best_index: int) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": route.get("geometry") or {"type": "LineString", "coordinates": []},
                "properties": {
                    "route_index": index,
                    "is_best": index == best_index,
                    "distance_m": route.get("distance", 0),
                    "duration_s": route.get("duration", 0),
                },
            }
            for index, route in enumerate(routes)
        ],
    }


def _route_response(osrm_data: dict[str, Any]) -> RouteResponse:
    routes = osrm_data.get("routes") or []
    if not routes:
        raise NotFoundError("No route found")
    best_index = min(range(len(routes)), key=lambda index: float(routes[index].get("duration") or float("inf")))
    summaries = [
        RouteSummary(
            route_index=index,
            is_best=index == best_index,
            distance_km=round(float(route.get("distance") or 0) / 1000, 3),
            duration_min=round(float(route.get("duration") or 0) / 60, 2),
            steps=_steps(route),
        )
        for index, route in enumerate(routes)
    ]
    return RouteResponse(best_route_index=best_index, routes=summaries, geojson=_route_geojson(routes, best_index))


class EvacuationRouteService:
    def __init__(self, osrm_client: OsrmClient | None = None) -> None:
        self.osrm_client = osrm_client or OsrmClient()

    async def routes(self, request: EvacuationRouteRequest) -> RouteResponse:
        return _route_response(await self.osrm_client.route(
            request.source,
            request.destination,
            costing=request.costing,
            alternatives=request.alternatives,
        ))

    async def nearest_hospital(self, request: NearestHospitalRequest) -> NearestHospitalResponse:
        candidates = await self._hospital_candidates(request)
        if not candidates:
            raise NotFoundError("No matching hospitals found near the vulnerable zone.")

        async def try_route(hospital: Hospital):
            destination = Coordinate(lat=hospital.lat, lon=hospital.lon)
            try:
                response = await self.routes(EvacuationRouteRequest(
                    source=request.origin,
                    destination=destination,
                    costing=request.costing,
                    alternatives=1,
                ))
                return hospital, response
            except Exception:
                return hospital, None

        results = await asyncio.gather(*(try_route(hospital) for hospital in candidates[:12]))
        reachable = [(hospital, response) for hospital, response in results if response is not None]
        if not reachable:
            raise NotFoundError("No reachable hospital found near the vulnerable zone.")
        hospital, route = min(reachable, key=lambda item: item[1].routes[item[1].best_route_index].duration_min)
        return NearestHospitalResponse(
            **route.model_dump(mode="json"),
            hospital=hospital,
            hospitals_geojson=hospitals_geojson(candidates[:25]),
        )

    async def plan(self, request: EvacuationPlanRequest) -> EvacuationPlanResponse:
        responder_route, hospital_route = await asyncio.gather(
            self.routes(EvacuationRouteRequest(
                source=request.responder_origin,
                destination=request.vulnerable_zone,
                costing=request.costing,
                alternatives=2,
            )),
            self.nearest_hospital(NearestHospitalRequest(
                origin=request.vulnerable_zone,
                costing=request.costing,
                hospital_type=request.hospital_type,
                search_radius_km=request.search_radius_km,
            )),
        )
        return EvacuationPlanResponse(
            responder_route=responder_route,
            hospital_route=hospital_route,
            vulnerable_zone=request.vulnerable_zone,
            responder_origin=request.responder_origin,
        )

    async def _hospital_candidates(self, request: NearestHospitalRequest) -> list[Hospital]:
        radii = [request.search_radius_km, min(request.search_radius_km * 2, 300)]
        for radius in radii:
            hospitals = await fetch_hospitals(request.origin, radius)
            if request.hospital_type == "govt":
                hospitals = [hospital for hospital in hospitals if "government" in hospital.type.lower()]
            elif request.hospital_type == "private":
                hospitals = [hospital for hospital in hospitals if "government" not in hospital.type.lower()]
            if hospitals:
                return hospitals
        return []

