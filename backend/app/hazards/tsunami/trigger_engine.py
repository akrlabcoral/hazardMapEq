from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from app.hazards.earthquake.ingest.normalizer import EarthquakeEvent


class TsunamiThreatLevel(str, Enum):
    WATCH = "WATCH"
    WARNING = "WARNING"
    EVACUATE = "EVACUATE"


@dataclass(frozen=True)
class RegionBox:
    name: str
    min_lon: float
    max_lon: float
    min_lat: float
    max_lat: float

    def contains(self, longitude: float, latitude: float) -> bool:
        return self.min_lon <= longitude <= self.max_lon and self.min_lat <= latitude <= self.max_lat


BAY_OF_BENGAL_REGION = RegionBox(
    name="Bay of Bengal",
    min_lon=78.0,
    max_lon=96.5,
    min_lat=5.0,
    max_lat=23.5,
)
ANDAMAN_REGION = RegionBox(
    name="Andaman region",
    min_lon=91.0,
    max_lon=95.5,
    min_lat=6.0,
    max_lat=14.5,
)
TSUNAMI_TRIGGER_REGIONS = (ANDAMAN_REGION, BAY_OF_BENGAL_REGION)
ALLOWED_MECHANISMS = {"thrust", "unknown"}


@dataclass(frozen=True)
class TsunamiTriggerResult:
    is_triggered: bool
    threat_level: TsunamiThreatLevel | None
    reason: str
    matched_region: str | None
    event_id: int | None
    source_id: str
    magnitude: float
    depth_km: float
    latitude: float
    longitude: float
    mechanism: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_triggered": self.is_triggered,
            "threat_level": self.threat_level.value if self.threat_level else None,
            "reason": self.reason,
            "matched_region": self.matched_region,
            "event_id": self.event_id,
            "source_id": self.source_id,
            "magnitude": self.magnitude,
            "depth_km": self.depth_km,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "mechanism": self.mechanism,
        }


def evaluate_tsunami_trigger(event: EarthquakeEvent) -> TsunamiTriggerResult:
    """Evaluate whether a newly ingested earthquake should raise a tsunami trigger."""
    mechanism = _get_mechanism(event)
    matched_region = _match_region(event.longitude, event.latitude)

    if event.magnitude < 6.5:
        return _not_triggered(event, mechanism, matched_region, "Magnitude is below Mw 6.5 trigger threshold")
    if event.depth_km > 70:
        return _not_triggered(event, mechanism, matched_region, "Earthquake depth is greater than 70 km")
    if mechanism not in ALLOWED_MECHANISMS:
        return _not_triggered(event, mechanism, matched_region, "Focal mechanism is not thrust or unknown")
    if matched_region is None:
        return _not_triggered(event, mechanism, matched_region, "Epicenter is outside Bay of Bengal and Andaman trigger regions")

    threat_level = _classify_threat_level(event.magnitude, event.depth_km)
    return TsunamiTriggerResult(
        is_triggered=True,
        threat_level=threat_level,
        reason=f"{threat_level.value} tsunami trigger criteria matched",
        matched_region=matched_region.name,
        event_id=event.db_id,
        source_id=event.source_id,
        magnitude=event.magnitude,
        depth_km=event.depth_km,
        latitude=event.latitude,
        longitude=event.longitude,
        mechanism=mechanism,
    )


def _classify_threat_level(magnitude: float, depth_km: float) -> TsunamiThreatLevel:
    if magnitude >= 8.5 or (magnitude >= 8.0 and depth_km <= 25):
        return TsunamiThreatLevel.EVACUATE
    if magnitude >= 7.5 or (magnitude >= 7.0 and depth_km <= 35):
        return TsunamiThreatLevel.WARNING
    return TsunamiThreatLevel.WATCH


def _match_region(longitude: float, latitude: float) -> RegionBox | None:
    for region in TSUNAMI_TRIGGER_REGIONS:
        if region.contains(longitude, latitude):
            return region
    return None


def _get_mechanism(event: EarthquakeEvent) -> str:
    for attr_name in ("mechanism", "focal_mechanism", "fault_mechanism"):
        value = getattr(event, attr_name, None)
        if value:
            return str(value).strip().lower()
    return "unknown"


def _not_triggered(
    event: EarthquakeEvent,
    mechanism: str,
    matched_region: RegionBox | None,
    reason: str,
) -> TsunamiTriggerResult:
    return TsunamiTriggerResult(
        is_triggered=False,
        threat_level=None,
        reason=reason,
        matched_region=matched_region.name if matched_region else None,
        event_id=event.db_id,
        source_id=event.source_id,
        magnitude=event.magnitude,
        depth_km=event.depth_km,
        latitude=event.latitude,
        longitude=event.longitude,
        mechanism=mechanism,
    )


__all__ = [
    "ANDAMAN_REGION",
    "BAY_OF_BENGAL_REGION",
    "TsunamiThreatLevel",
    "TsunamiTriggerResult",
    "evaluate_tsunami_trigger",
]
