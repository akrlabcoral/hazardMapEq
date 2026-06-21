from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import ORJSONResponse

from app.core.errors import ValidationError
from app.hazards.earthquake.service import earthquake_service

router = APIRouter()


@router.get("")
def get_historic_events(
    request: Request,
    min_magnitude: float | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=100_000),
    bbox: str | None = Query(default=None, description="west,south,east,north"),
):
    """Return historic earthquake events as a GeoJSON FeatureCollection."""
    try:
        data = earthquake_service.get_historic_events(
            min_magnitude=min_magnitude,
            limit=limit,
            bbox=bbox,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    etag = earthquake_service.historic_etag(data)
    headers = {
        "Cache-Control": "public, max-age=300",
        "ETag": etag,
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return ORJSONResponse(data, headers=headers)
