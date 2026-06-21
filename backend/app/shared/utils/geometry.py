"""Geometry helpers shared by hazard modules."""
from __future__ import annotations


def point_feature(longitude: float, latitude: float, properties: dict | None = None) -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
        "properties": properties or {},
    }

