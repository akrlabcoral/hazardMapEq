"""Reusable GIS helpers and service lifecycle utilities."""


def close_all_gis_services() -> None:
    from app.shared.gis.bathymetry_service import bathymetry_service
    from app.shared.gis.population_service import population_service
    from app.shared.gis.terrain_service import terrain_service

    bathymetry_service.close()
    population_service.close()
    terrain_service.close()


__all__ = ["close_all_gis_services"]
