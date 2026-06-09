from __future__ import annotations

from app.jobs import simulation_worker
from app.jobs.simulation_worker import GridContext, SimulationRunner


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
        "generate_contour_geojson",
        lambda features, raw_pga: {"type": "FeatureCollection", "features": []},
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
    assert "district_summary" in result
    assert "state_summary" in result
