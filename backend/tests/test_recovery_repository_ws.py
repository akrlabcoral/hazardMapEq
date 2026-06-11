from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest

from app.api import ws
from app.models import database
from app.services import recovery


def test_database_access_fails_clearly_before_startup():
    with pytest.raises(RuntimeError, match="Database pool is not initialized"):
        database.ensure_pool()


def test_recovery_reconstructs_required_event_fields(monkeypatch):
    now = datetime.now(timezone.utc)
    monkeypatch.setattr(recovery, "get_unsimulated_events", lambda minutes: [{
        "id": 7,
        "source_id": "s",
        "source": "USGS",
        "fingerprint": "f",
        "latitude": 1.0,
        "longitude": 2.0,
        "depth_km": 3.0,
        "magnitude": 4.0,
        "mag_type": "Mw",
        "origin_time": now,
        "place": None,
        "status": None,
        "alert_level": None,
    }])

    async def acquire_lock_token(*args, **kwargs):
        return "test-lock"

    async def release_lock(*args, **kwargs):
        return True

    monkeypatch.setattr(recovery.redis_manager, "acquire_lock_token", acquire_lock_token)
    monkeypatch.setattr(recovery.redis_manager, "release_lock", release_lock)
    queue = asyncio.Queue()

    assert asyncio.run(recovery.recover_unsimulated_events(queue)) == 1
    event = queue.get_nowait()
    assert event.db_id == 7
    assert event.status == "automatic"
    assert event.alert_level is None


def test_websocket_broadcast_removes_dead_clients():
    class GoodClient:
        def __init__(self):
            self.sent = []

        async def send_text(self, payload):
            self.sent.append(payload)

    class DeadClient:
        async def send_text(self, payload):
            raise RuntimeError("closed")

    good = GoodClient()
    dead = DeadClient()
    ws._CLIENTS.clear()
    ws._CLIENTS.update({good, dead})

    asyncio.run(ws.broadcast({"type": "ping"}))

    assert good in ws._CLIENTS
    assert dead not in ws._CLIENTS
    assert good.sent
    ws._CLIENTS.clear()
