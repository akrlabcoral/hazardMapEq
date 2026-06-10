from fastapi import APIRouter
from app.models.historic_repository import get_historic_events_geojson

router = APIRouter()

@router.get("")
def get_historic_events():
    """Returns all historic earthquake events formatted as a GeoJSON FeatureCollection."""
    return get_historic_events_geojson()
