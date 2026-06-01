"""
app/ingest/ncs_scraper.py

Scrapes earthquake data from the NCS India website (https://riseq.seismo.gov.in/)
and maps it into the canonical EarthquakeEvent structure.
"""
from __future__ import annotations

import re
import json
import logging
import aiohttp
from datetime import datetime, timezone, timedelta

from app.ingest.normalizer import EarthquakeEvent, compute_fingerprint

logger = logging.getLogger("hazardmap.ncs_scraper")

NCS_URL = "https://riseq.seismo.gov.in/"
IST_OFFSET = timedelta(hours=5, minutes=30)


async def fetch_ncs_events(session: aiohttp.ClientSession) -> list[EarthquakeEvent]:
    """
    Fetches the NCS homepage, extracts data-json attributes, and parses them.
    Returns a list of EarthquakeEvent objects. Returns empty list on failure.
    """
    events = []
    try:
        timeout = aiohttp.ClientTimeout(total=15.0)
        async with session.get(NCS_URL, timeout=timeout) as resp:
            resp.raise_for_status()
            html = await resp.text()

        # Extract all data-json attributes
        matches = re.findall(r"data-json='\s*({.*?})\s*'", html)
        
        for m in matches:
            try:
                obj = json.loads(m)
                event = _parse_ncs_object(obj)
                if event:
                    events.append(event)
            except json.JSONDecodeError:
                continue

    except Exception as e:
        logger.warning(f"[NCS Scraper] Failed to fetch or parse NCS data: {e}")

    return events


def _parse_ncs_object(obj: dict) -> EarthquakeEvent | None:
    """
    Converts a single parsed JSON dictionary from NCS into an EarthquakeEvent.
    """
    try:
        # e.g., "TnlvSEl1eGVnLzBmWmN1TzBCcVJtQT09"
        event_id = obj["event_id"]
        
        # e.g., "29.811, 80.490"
        lat_str, lon_str = obj["lat_long"].split(",")
        lat = float(lat_str.strip())
        lon = float(lon_str.strip())
        
        # e.g., "M: 2.6 , D: 5km"
        mag_depth_str = obj["magnitude_depth"]
        mag_part, depth_part = mag_depth_str.split(",")
        # "M: 2.6 " -> "2.6"
        magnitude = float(mag_part.split(":")[1].strip())
        # " D: 5km" -> "5"
        depth_str = depth_part.split(":")[1].strip().replace("km", "").replace("KM", "").strip()
        depth_km = float(depth_str)
        
        # e.g., "2026-06-01 07:29:24 IST"
        time_str = obj["origin_time"].replace("IST", "").strip()
        # Parse local IST time
        local_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
        # Convert to UTC
        utc_time = (local_time - IST_OFFSET).replace(tzinfo=timezone.utc)
        
        place = obj.get("event_name", "Unknown location")
        # Clean up place (e.g. "M: 2.6 - Pithoragarh, Uttarakhand" -> "Pithoragarh, Uttarakhand")
        if " - " in place:
            place = place.split(" - ", 1)[1]
            
        status = obj.get("event_type", "Reviewed").lower()
        
        source_id = f"ncs:{event_id}"
        fingerprint = compute_fingerprint(lat, lon, magnitude, utc_time)

        return EarthquakeEvent(
            source_id=source_id,
            source="NCS",
            fingerprint=fingerprint,
            latitude=lat,
            longitude=lon,
            depth_km=depth_km,
            magnitude=magnitude,
            mag_type="Mw", # NCS doesn't specify, assume Mw
            origin_time=utc_time,
            place=place,
            status=status,
            alert_level=None,
        )
    except Exception as e:
        # Ignore malformed objects silently in production
        return None
