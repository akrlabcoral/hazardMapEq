from __future__ import annotations

import pytest

from app.jobs import simulation_worker
from app.jobs.simulation_worker import GridContext, SimulationRunner, mmi_to_roman, pga_g_to_mmi


def _feature(cell_id, lon, lat):
    return {
        "type": "Feature",
        "properties": {
            "cell_id": cell_id,
            "centroid_lon": lon,
            "centroid_lat": lat,
            "state": "Test State",
            "district": "Test District",
            "population": 10,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[lon, lat], [lon + 0.1, lat], [lon + 0.1, lat + 0.1], [lon, lat + 0.1], [lon, lat]]],
        },
    }


def test_simulation_runner_response_shape(monkeypatch):
    features = [
        _feature("a", 77.0, 28.0),
        _feature("b", 77.1, 28.0),
        _feature("c", 77.0, 28.1),
        _feature("d", 77.1, 28.1),
    ]
    context = GridContext.load_from_geojson({"type": "FeatureCollection", "features": features})

    monkeypatch.setattr(simulation_worker, "save_simulation", lambda **kwargs: 123)
    monkeypatch.setattr(
        simulation_worker,
        "generate_both_contours",
        lambda features, pga_values, mmi_values: ({"type": "FeatureCollection", "features": []}, {"type": "FeatureCollection", "features": []}),
    )

    result = SimulationRunner(context).run_simulation(
        latitude=28.05,
        longitude=77.05,
        magnitude=5.0,
        depth_km=10,
    )

    assert result["simulation_id"] == 123
    assert result["grid_geojson"]["type"] == "FeatureCollection"
    assert result["contour_geojson"]["type"] == "FeatureCollection"
    assert result["intensity_contour_geojson"]["type"] == "FeatureCollection"
    assert "district_summary" in result
    assert "state_summary" in result
    first_props = result["grid_geojson"]["features"][0]["properties"]
    assert "mmi" in first_props
    assert "intensity" in first_props


def test_mmi_formula_uses_pga_in_cm_per_second_squared():
    assert pga_g_to_mmi(1.0) == pytest.approx(9.289, abs=0.001)
    assert pga_g_to_mmi(0.01) == pytest.approx(1.969, abs=0.001)
    assert mmi_to_roman(9.289) == "IX"
    assert mmi_to_roman(10.0) == "X+"
