from __future__ import annotations

from app.hazards.tsunami.damage.estimator import DamageAssessmentInput, TsunamiDamageEstimator
from app.hazards.tsunami.schemas import TsunamiDamageAssessmentRequest
from app.hazards.tsunami.service import TsunamiService
from app.main import app


class FakePopulation:
    def __init__(self, available: bool = True, value: int = 100) -> None:
        self.available = available
        self.value = value
        self.sampled_coords = []

    def is_available(self) -> bool:
        return self.available

    def sample_population_batch(self, coords):
        self.sampled_coords.extend(coords)
        return [self.value for _ in coords]


def _extent():
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        "properties": {},
    }


def _depth_points(depths):
    features = []
    for index, depth in enumerate(depths):
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [80.0 + index * 0.01, 12.0]},
            "properties": {"flood_depth_m": depth},
        })
    return {"type": "FeatureCollection", "features": features}


def test_missing_population_returns_unavailable():
    estimator = TsunamiDamageEstimator(population=FakePopulation(available=False))

    result = estimator.assess(
        DamageAssessmentInput(
            flood_extent_polygon=_extent(),
            flood_depth_points=_depth_points([1.0]),
        )
    )

    assert result.is_available is False
    assert result.affected_population == 0
    assert "Population raster" in result.metadata["reason"]


def test_flood_depth_points_produce_affected_population():
    estimator = TsunamiDamageEstimator(population=FakePopulation(value=100))

    result = estimator.assess(
        DamageAssessmentInput(
            flood_extent_polygon=_extent(),
            flood_depth_points=_depth_points([0.5, 1.5, 2.5]),
            max_flood_depth_m=2.5,
        )
    )

    assert result.is_available is True
    assert result.affected_population == 300
    assert result.building_damage["estimated_damaged_buildings"] > 0
    assert result.economic_loss["estimated_total_loss"] > 0
    assert result.casualty_estimate["estimated_injuries"] > 0


def test_deeper_flood_depth_increases_damage_loss_and_casualties():
    estimator = TsunamiDamageEstimator(population=FakePopulation(value=100))
    shallow = estimator.assess(
        DamageAssessmentInput(
            flood_extent_polygon=_extent(),
            flood_depth_points=_depth_points([0.25, 0.25]),
            max_flood_depth_m=0.25,
        )
    )
    deep = estimator.assess(
        DamageAssessmentInput(
            flood_extent_polygon=_extent(),
            flood_depth_points=_depth_points([3.0, 3.0]),
            max_flood_depth_m=3.0,
        )
    )

    assert deep.building_damage["estimated_damaged_buildings"] > shallow.building_damage["estimated_damaged_buildings"]
    assert deep.economic_loss["estimated_total_loss"] > shallow.economic_loss["estimated_total_loss"]
    assert deep.casualty_estimate["estimated_injuries"] > shallow.casualty_estimate["estimated_injuries"]


def test_duplicate_coordinates_are_not_double_counted():
    population = FakePopulation(value=100)
    estimator = TsunamiDamageEstimator(population=population)
    duplicate_points = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [80.00001, 12.00001]},
                "properties": {"flood_depth_m": 1.0},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [80.00002, 12.00002]},
                "properties": {"flood_depth_m": 3.0},
            },
        ],
    }

    result = estimator.assess(
        DamageAssessmentInput(
            flood_extent_polygon=_extent(),
            flood_depth_points=duplicate_points,
            max_flood_depth_m=3.0,
        )
    )

    assert result.affected_population == 100
    assert len(population.sampled_coords) == 1


def test_critical_infrastructure_exposure_is_structured_unavailable():
    estimator = TsunamiDamageEstimator(population=FakePopulation(value=100))

    result = estimator.assess(
        DamageAssessmentInput(
            flood_extent_polygon=_extent(),
            flood_depth_points=_depth_points([1.0]),
        )
    )

    assert result.critical_infrastructure_exposure["is_available"] is False
    assert result.critical_infrastructure_exposure["exposed_assets"] == []


def test_tsunami_damage_service_response_shape_with_injected_estimator():
    service = TsunamiService(
        damage_estimator=TsunamiDamageEstimator(population=FakePopulation(value=50))
    )

    response = service.assess_damage(
        TsunamiDamageAssessmentRequest(
            flood_extent_polygon=_extent(),
            flood_depth_points=_depth_points([1.5, 2.5]),
            max_flood_depth_m=2.5,
        )
    )

    assert response.is_available is True
    assert response.affected_population == 100
    assert response.inputs.max_flood_depth_m == 2.5


def test_tsunami_damage_assessment_route_is_registered():
    paths = {getattr(route, "path", "") for route in app.routes}

    assert "/api/hazards/tsunami/damage-assessment" in paths
    assert "/api/hazards/tsunami/calculate" in paths
    assert "/api/hazards/tsunami/source-model" in paths
    assert "/api/hazards/tsunami/wave-propagation" in paths
    assert "/api/hazards/tsunami/inundation" in paths
