"""
app/soil/__init__.py
Exposes the top-level soil subsystem API for use by the simulation pipeline.
"""
from app.soil.loader import load_all_soil_rasters
from app.soil.sampler import sample_batch
from app.soil.site_class import get_site_class, get_site_classes_batch
from app.soil.amplification import get_amplification_factor, get_amplification_batch

__all__ = [
    "load_all_soil_rasters",
    "sample_batch",
    "get_site_class",
    "get_site_classes_batch",
    "get_amplification_factor",
    "get_amplification_batch",
]
