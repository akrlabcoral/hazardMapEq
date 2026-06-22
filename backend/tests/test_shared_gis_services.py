from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from app.hazards.earthquake.ingest import filter as earthquake_filter
from app.hazards.tsunami.schemas import TsunamiCalculationRequest
from app.hazards.tsunami import service as tsunami_service_module
from app.shared.gis.bathymetry_service import BathymetryService
from app.shared.gis.boundary_service import BoundaryService
from app.shared.gis.population_service import PopulationService
from app.shared.gis.raster_loader import LazyRasterResource
from app.shared.gis.terrain_service import TerrainService


class FakeDataset:
    bounds = SimpleNamespace(left=0.0, bottom=0.0, right=10.0, top=10.0)

    def __init__(self):
        self.closed = False

    def sample(self, coords):
        return [[lon + lat] for lon, lat in coords]

    def close(self):
        self.closed = True


def test_lazy_raster_opens_once_and_reuses_handle(monkeypatch):
    opened = []

    def fake_open(path):
        opened.append(path)
        return FakeDataset()

    monkeypatch.setattr("app.shared.gis.raster_loader.rasterio.open", fake_open)
    monkeypatch.setattr("app.shared.gis.raster_loader.raster_path_exists", lambda path: True)

    resource = LazyRasterResource("test", "/tmp/test.tif")

    assert resource.sample_point(1, 2) == 3
    assert resource.sample_point(3, 4) == 7
    assert resource.open_count == 1
    assert opened == ["/tmp/test.tif"]


def test_optional_raster_services_fail_closed():
    assert BathymetryService(path="").sample_depth_m(80, 12) is None
    assert TerrainService(path="").sample_elevation_m(80, 12) is None
    assert PopulationService(path="").sample_population(80, 12) == 0


def test_boundary_service_fallback_preserves_supported_region_check(tmp_path):
    service = BoundaryService(path=str(tmp_path / "missing.geojson"))

    assert service.contains_supported_epicenter(28.6139, 77.2090)
    assert not service.contains_supported_epicenter(-40.0, -120.0)


def test_earthquake_filter_uses_shared_boundary_service():
    source = Path(earthquake_filter.__file__).read_text()

    assert "app.gis.boundary" not in source
    assert "boundary_service" in source


def test_tsunami_analysis_can_touch_optional_gis_services_without_response_change(monkeypatch):
    calls = {"bathymetry": 0, "coastline": 0}

    def sample_depth_m(lon, lat):
        calls["bathymetry"] += 1
        return None

    def get_geometry():
        calls["coastline"] += 1
        return None

    monkeypatch.setattr(tsunami_service_module.bathymetry_service, "sample_depth_m", sample_depth_m)
    monkeypatch.setattr(tsunami_service_module.coastline_service, "get_geometry", get_geometry)

    result = tsunami_service_module.tsunami_service.run_analysis(
        TsunamiCalculationRequest(magnitude=7.1, latitude=14.0, longitude=88.0)
    )

    assert result.tsunami_speed_mps > 0
    assert calls == {"bathymetry": 1, "coastline": 1}
