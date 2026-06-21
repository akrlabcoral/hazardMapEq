"""
app/ingest/normalizer.py

Converts a raw USGS GeoJSON feature into a canonical EarthquakeEvent dataclass.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class EarthquakeEvent:
    """Canonical internal representation of an earthquake event."""
    # Identity
    source_id:   str            # "usgs:us7000mxyz"
    source:      str            # "USGS"
    fingerprint: str            # spatial-temporal dedup hash

    # Physical parameters
    latitude:    float
    longitude:   float
    depth_km:    float
    magnitude:   float
    mag_type:    str            # "Mw" | "Mb" | "ML" | "Ms"
    origin_time: datetime       # UTC-aware datetime

    # Metadata
    place:       str
    status:      str            # "automatic" | "reviewed"
    alert_level: str | None     # "green" | "yellow" | "orange" | "red" | None

    # Set after DB insert
    db_id: int | None = field(default=None, repr=False)


def compute_fingerprint(lat: float, lon: float, magnitude: float, origin_time: datetime) -> str:
    """
    Spatial-temporal fingerprint — two-minute time buckets at ~10 km lat/lon precision.
    Identical earthquakes from different agencies will produce the same fingerprint.
    """
    bucket = int(origin_time.timestamp() // 120)  # 2-minute windows
    raw = f"{round(lat, 1)}:{round(lon, 1)}:{round(magnitude, 1)}:{bucket}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def normalize_usgs_feature(feature: dict) -> EarthquakeEvent | None:
    """
    Convert a single USGS GeoJSON feature dict into an EarthquakeEvent.
    Returns None if the feature is malformed or missing required fields.
    """
    try:
        props = feature["properties"]
        geom  = feature["geometry"]["coordinates"]  # [lon, lat, depth_km]

        usgs_id    = feature["id"]
        lon        = float(geom[0])
        lat        = float(geom[1])
        depth_km   = float(geom[2]) if geom[2] is not None else 10.0
        magnitude  = float(props["mag"])
        mag_type   = props.get("magType") or "Mw"
        place      = props.get("place") or "Unknown location"
        status     = props.get("status") or "automatic"
        alert_level = props.get("alert")  # None if not set

        # USGS time is milliseconds since epoch
        origin_ms   = int(props["time"])
        origin_time = datetime.fromtimestamp(origin_ms / 1000, tz=timezone.utc)

        source_id   = f"usgs:{usgs_id}"
        fingerprint = compute_fingerprint(lat, lon, magnitude, origin_time)

        return EarthquakeEvent(
            source_id   = source_id,
            source      = "USGS",
            fingerprint = fingerprint,
            latitude    = lat,
            longitude   = lon,
            depth_km    = depth_km,
            magnitude   = magnitude,
            mag_type    = mag_type,
            origin_time = origin_time,
            place       = place,
            status      = status,
            alert_level = alert_level,
        )
    except (KeyError, TypeError, ValueError, IndexError):
        return None


def is_valid(event: EarthquakeEvent) -> bool:
    """Basic sanity check on physical parameters."""
    now = datetime.now(tz=timezone.utc)
    return all([
        -90.0  <= event.latitude  <= 90.0,
        -180.0 <= event.longitude <= 180.0,
        0.0    <  event.depth_km  <= 700.0,
        1.0    <= event.magnitude <= 10.0,
        (now - event.origin_time).total_seconds() <= 7200,  # not older than 2 hours
    ])


def event_to_payload(event: EarthquakeEvent) -> dict:
    """Frontend/WebSocket-safe event payload."""
    return {
        "id": event.db_id,
        "source_id": event.source_id,
        "source": event.source,
        "magnitude": event.magnitude,
        "latitude": event.latitude,
        "longitude": event.longitude,
        "depth_km": event.depth_km,
        "mag_type": event.mag_type,
        "origin_time": event.origin_time.isoformat(),
        "place": event.place,
        "status": event.status,
        "alert_level": event.alert_level,
    }
