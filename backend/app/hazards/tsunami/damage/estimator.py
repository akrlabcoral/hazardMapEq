from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from app.shared.gis.population_service import population_service

PEOPLE_PER_BUILDING = 4.5
BUILDING_REPLACEMENT_COST_USD = 25_000


class PopulationSampler(Protocol):
    def is_available(self) -> bool:
        ...

    def sample_population_batch(self, coords: list[tuple[float, float]]) -> list[int]:
        ...


@dataclass(frozen=True)
class DamageAssessmentInput:
    flood_extent_polygon: dict[str, Any] | None
    flood_depth_points: dict[str, Any]
    runup_height_m: float | None = None
    max_flood_depth_m: float | None = None
    inundation_distance_m: float | None = None


@dataclass(frozen=True)
class DamageAssessment:
    is_available: bool
    affected_population: int
    building_damage: dict[str, Any]
    economic_loss: dict[str, Any]
    casualty_estimate: dict[str, Any]
    critical_infrastructure_exposure: dict[str, Any]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_available": self.is_available,
            "affected_population": self.affected_population,
            "building_damage": self.building_damage,
            "economic_loss": self.economic_loss,
            "casualty_estimate": self.casualty_estimate,
            "critical_infrastructure_exposure": self.critical_infrastructure_exposure,
            "metadata": self.metadata,
        }


class TsunamiDamageEstimator:
    def __init__(self, population: PopulationSampler = population_service) -> None:
        self.population = population

    def assess(self, request: DamageAssessmentInput) -> DamageAssessment:
        if not self.population.is_available():
            return _unavailable("Population raster is not configured or unavailable")
        if not request.flood_extent_polygon:
            return _unavailable("Flood extent polygon is required for damage assessment")

        samples = _unique_depth_samples(request.flood_depth_points)
        if not samples:
            return _unavailable("Flood depth points are required for damage assessment")

        coords = [(sample["lon"], sample["lat"]) for sample in samples]
        populations = self.population.sample_population_batch(coords)
        weighted_population = 0.0
        weighted_damage = 0.0
        weighted_casualty_rate = 0.0

        for sample, population_count in zip(samples, populations, strict=False):
            depth = sample["flood_depth_m"]
            damage_ratio = depth_damage_ratio(depth)
            casualty_rate = depth_casualty_rate(depth)
            weighted_population += population_count
            weighted_damage += population_count * damage_ratio
            weighted_casualty_rate += population_count * casualty_rate

        affected_population = int(round(weighted_population))
        if affected_population <= 0:
            return _unavailable("Population samples inside flood extent are zero")

        average_damage_ratio = weighted_damage / affected_population
        average_casualty_rate = weighted_casualty_rate / affected_population
        exposed_buildings = affected_population / PEOPLE_PER_BUILDING
        damaged_buildings = exposed_buildings * average_damage_ratio
        destroyed_buildings = exposed_buildings * max(average_damage_ratio - 0.65, 0.0) / 0.35
        injuries = affected_population * average_casualty_rate
        fatalities = injuries * fatality_share(request.max_flood_depth_m or 0.0)
        total_loss = damaged_buildings * BUILDING_REPLACEMENT_COST_USD

        return DamageAssessment(
            is_available=True,
            affected_population=affected_population,
            building_damage={
                "estimated_exposed_buildings": int(round(exposed_buildings)),
                "estimated_damaged_buildings": int(round(damaged_buildings)),
                "estimated_destroyed_buildings": int(round(destroyed_buildings)),
                "mean_damage_ratio": average_damage_ratio,
            },
            economic_loss={
                "estimated_total_loss": total_loss,
                "currency": "USD",
                "replacement_cost_per_building": BUILDING_REPLACEMENT_COST_USD,
                "method": "population-derived empirical building loss",
            },
            casualty_estimate={
                "estimated_injuries": int(round(injuries)),
                "estimated_fatalities": int(round(fatalities)),
                "casualty_rate": average_casualty_rate,
            },
            critical_infrastructure_exposure={
                "is_available": False,
                "reason": "No infrastructure dataset configured in v1",
                "exposed_assets": [],
            },
            metadata={
                "model": "tsunami_empirical_damage_v1",
                "population_source": "population_service",
                "people_per_building": PEOPLE_PER_BUILDING,
                "sample_count": len(samples),
                "runup_height_m": request.runup_height_m,
                "max_flood_depth_m": request.max_flood_depth_m,
                "inundation_distance_m": request.inundation_distance_m,
                "disclaimer": "Empirical damage estimate; not for official warning or emergency decisions.",
            },
        )


def depth_damage_ratio(flood_depth_m: float) -> float:
    if flood_depth_m <= 0:
        return 0.0
    if flood_depth_m < 0.5:
        return 0.10
    if flood_depth_m < 1.0:
        return 0.25
    if flood_depth_m < 2.0:
        return 0.50
    if flood_depth_m < 4.0:
        return 0.75
    return 0.95


def depth_casualty_rate(flood_depth_m: float) -> float:
    if flood_depth_m <= 0:
        return 0.0
    if flood_depth_m < 0.5:
        return 0.001
    if flood_depth_m < 1.0:
        return 0.005
    if flood_depth_m < 2.0:
        return 0.02
    if flood_depth_m < 4.0:
        return 0.06
    return 0.12


def fatality_share(max_flood_depth_m: float) -> float:
    if max_flood_depth_m < 1.0:
        return 0.05
    if max_flood_depth_m < 2.0:
        return 0.12
    if max_flood_depth_m < 4.0:
        return 0.25
    return 0.40


def _unique_depth_samples(flood_depth_points: dict[str, Any]) -> list[dict[str, float]]:
    seen: set[tuple[float, float]] = set()
    samples: list[dict[str, float]] = []
    for feature in flood_depth_points.get("features", []):
        geometry = feature.get("geometry") or {}
        properties = feature.get("properties") or {}
        if geometry.get("type") != "Point":
            continue
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) < 2:
            continue
        depth = properties.get("flood_depth_m")
        if depth is None:
            continue
        lon = float(coordinates[0])
        lat = float(coordinates[1])
        key = (round(lon, 4), round(lat, 4))
        if key in seen:
            continue
        seen.add(key)
        samples.append({"lon": lon, "lat": lat, "flood_depth_m": max(float(depth), 0.0)})
    return samples


def _unavailable(reason: str) -> DamageAssessment:
    return DamageAssessment(
        is_available=False,
        affected_population=0,
        building_damage={
            "estimated_exposed_buildings": 0,
            "estimated_damaged_buildings": 0,
            "estimated_destroyed_buildings": 0,
            "mean_damage_ratio": 0.0,
        },
        economic_loss={
            "estimated_total_loss": 0.0,
            "currency": "USD",
            "replacement_cost_per_building": BUILDING_REPLACEMENT_COST_USD,
            "method": "population-derived empirical building loss",
        },
        casualty_estimate={
            "estimated_injuries": 0,
            "estimated_fatalities": 0,
            "casualty_rate": 0.0,
        },
        critical_infrastructure_exposure={
            "is_available": False,
            "reason": "No infrastructure dataset configured in v1",
            "exposed_assets": [],
        },
        metadata={
            "model": "tsunami_empirical_damage_v1",
            "status": "unavailable",
            "reason": reason,
            "disclaimer": "Empirical damage estimate; not for official warning or emergency decisions.",
        },
    )


__all__ = [
    "DamageAssessment",
    "DamageAssessmentInput",
    "TsunamiDamageEstimator",
    "depth_casualty_rate",
    "depth_damage_ratio",
]
