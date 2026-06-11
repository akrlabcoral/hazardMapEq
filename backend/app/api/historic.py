import hashlib

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import ORJSONResponse

from app.models.historic_repository import get_historic_events_geojson

router = APIRouter()


def _historic_etag(data: dict) -> str:
    digest = hashlib.sha1()
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        digest.update(str(props.get("id", "")).encode())
        digest.update(str(props.get("time", "")).encode())
        digest.update(str(props.get("mag", "")).encode())
        digest.update(str(props.get("depth", "")).encode())
    return f'W/"historic-{len(data.get("features", []))}-{digest.hexdigest()}"'


@router.get("")
def get_historic_events(
    request: Request,
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

    etag = _historic_etag(data)
    headers = {
        "Cache-Control": "public, max-age=300",
        "ETag": etag,
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return ORJSONResponse(data, headers=headers)
