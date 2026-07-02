"""Top-level API router composition."""
from __future__ import annotations

from fastapi import APIRouter

from app.api import evacuation as evacuation_module
from app.api import events as events_module
from app.api import historic as historic_module
from app.api import simulate
from app.api import ws as ws_module
from app.api.hazards.router import router as hazards_router

router = APIRouter()
router.include_router(simulate.router)
router.include_router(ws_module.router)
router.include_router(events_module.router)
router.include_router(historic_module.router, prefix="/historic", tags=["historic"])
router.include_router(evacuation_module.router)
router.include_router(hazards_router)
