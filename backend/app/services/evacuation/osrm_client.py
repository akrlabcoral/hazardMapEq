from __future__ import annotations

import asyncio
from typing import Any

import aiohttp

from app.config import settings
from app.core.errors import NotFoundError, ServiceUnavailableError
from app.services.evacuation.schemas import Coordinate


_session: aiohttp.ClientSession | None = None
_session_lock = asyncio.Lock()


async def _get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        async with _session_lock:
            if _session is None or _session.closed:
                timeout = aiohttp.ClientTimeout(total=settings.osrm_timeout_seconds)
                _session = aiohttp.ClientSession(timeout=timeout)
    return _session


def _profile(costing: str) -> str:
    return {
        "auto": "driving",
        "bicycle": "cycling",
        "pedestrian": "foot",
    }.get(costing, "driving")


class OsrmClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.osrm_base_url).rstrip("/")

    async def route(
        self,
        source: Coordinate,
        destination: Coordinate,
        *,
        costing: str = "auto",
        alternatives: int = 2,
    ) -> dict[str, Any]:
        coords = f"{source.lon},{source.lat};{destination.lon},{destination.lat}"
        url = f"{self.base_url}/route/v1/{_profile(costing)}/{coords}"
        params = {
            "alternatives": str(min(max(alternatives, 0), 3)),
            "steps": "true",
            "geometries": "geojson",
            "overview": "full",
            "annotations": "false",
        }
        session = await _get_session()
        try:
            async with session.get(url, params=params) as response:
                data = await response.json()
        except Exception as exc:
            raise ServiceUnavailableError(f"OSRM routing service is unavailable: {exc}") from exc

        if data.get("code") != "Ok":
            raise NotFoundError(f"No route found: {data.get('message', 'unknown error')}")
        return data

