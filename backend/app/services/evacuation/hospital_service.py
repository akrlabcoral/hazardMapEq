from __future__ import annotations

import math
import time
from typing import Any

import aiohttp

from app.core.errors import ServiceUnavailableError
from app.services.evacuation.schemas import Coordinate, Hospital

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
CACHE_TTL_SECONDS = 6 * 3600
_cache: dict[str, tuple[float, list[Hospital]]] = {}


def _bbox(origin: Coordinate, radius_km: float) -> tuple[float, float, float, float]:
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / max(111.0 * math.cos(math.radians(origin.lat)), 1.0)
    return (
        max(-90.0, origin.lat - lat_delta),
        max(-180.0, origin.lon - lon_delta),
        min(90.0, origin.lat + lat_delta),
        min(180.0, origin.lon + lon_delta),
    )


def _query(origin: Coordinate, radius_km: float) -> str:
    south, west, north, east = _bbox(origin, radius_km)
    return f"""
    [out:json][timeout:45];
    (
      nwr["amenity"="hospital"]({south},{west},{north},{east});
      nwr["amenity"="clinic"]({south},{west},{north},{east});
      nwr["healthcare"="hospital"]({south},{west},{north},{east});
      nwr["healthcare"="clinic"]({south},{west},{north},{east});
      nwr["healthcare"="health_centre"]({south},{west},{north},{east});
    );
    out center tags;
    """


def _classify(tags: dict[str, Any]) -> str:
    text = " ".join(str(tags.get(key, "")) for key in ("operator:type", "operator", "ownership", "name", "name:en")).lower()
    govt_keywords = ("government", "govt", "district", "state", "municipal", "medical college", "phc", "chc", "public")
    return "Government Hospital" if any(keyword in text for keyword in govt_keywords) else "Private Hospital"


def _parse_hospital(element: dict[str, Any]) -> Hospital | None:
    tags = element.get("tags") or {}
    if element.get("type") == "node":
        lat = element.get("lat")
        lon = element.get("lon")
    else:
        center = element.get("center") or {}
        lat = center.get("lat")
        lon = center.get("lon")
    if lat is None or lon is None:
        return None
    return Hospital(
        name=(tags.get("name:en") or tags.get("name") or tags.get("official_name") or "Unnamed hospital").strip(),
        lat=float(lat),
        lon=float(lon),
        type=_classify(tags),
    )


def haversine_km(a: Coordinate, b: Coordinate) -> float:
    radius = 6371.0
    dlat = math.radians(b.lat - a.lat)
    dlon = math.radians(b.lon - a.lon)
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return radius * 2 * math.asin(math.sqrt(value))


async def fetch_hospitals(origin: Coordinate, radius_km: float) -> list[Hospital]:
    cache_key = f"{round(origin.lat, 2)}:{round(origin.lon, 2)}:{round(radius_km)}"
    now = time.monotonic()
    cached = _cache.get(cache_key)
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    last_error: Exception | None = None
    timeout = aiohttp.ClientTimeout(total=60)
    async with aiohttp.ClientSession(timeout=timeout, headers={"User-Agent": "HazardMap-Evacuation/1.0"}) as session:
        for url in OVERPASS_URLS:
            try:
                async with session.post(url, data={"data": _query(origin, radius_km)}) as response:
                    response.raise_for_status()
                    data = await response.json()
                hospitals: list[Hospital] = []
                seen: set[str] = set()
                for element in data.get("elements", []):
                    hospital = _parse_hospital(element)
                    if hospital is None:
                        continue
                    key = f"{round(hospital.lat, 5)}:{round(hospital.lon, 5)}"
                    if key in seen:
                        continue
                    seen.add(key)
                    hospitals.append(hospital)
                hospitals.sort(key=lambda hospital: haversine_km(origin, Coordinate(lat=hospital.lat, lon=hospital.lon)))
                _cache[cache_key] = (now, hospitals)
                return hospitals
            except Exception as exc:
                last_error = exc
    raise ServiceUnavailableError(f"Hospital data service is unavailable: {last_error}")


def hospitals_geojson(hospitals: list[Hospital]) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [hospital.lon, hospital.lat]},
                "properties": {"name": hospital.name, "type": hospital.type},
            }
            for hospital in hospitals
        ],
    }

