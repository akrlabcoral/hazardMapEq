from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import ORJSONResponse

from app.models.historic_repository import get_historic_events_geojson

router = APIRouter()

@router.get("")
def get_historic_events(
    min_magnitude: float | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=100_000),
    bbox: str | None = Query(default=None, description="west,south,east,north"),
):
    """Return historic earthquake events as a GeoJSON FeatureCollection."""
    try:
        data = get_historic_events_geojson(
            min_magnitude=min_magnitude,
            limit=limit,
            bbox=bbox,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ORJSONResponse(data)
