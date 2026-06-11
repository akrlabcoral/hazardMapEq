"""
app/api/ws.py

WebSocket endpoint — real-time push from backend to all connected browser clients.

Clients connect once and receive:
  - earthquake_detected  → event was ingested from USGS
  - simulation_running   → worker picked up the event
  - simulation_complete  → full simulation result (triggers map update)
  - simulation_error     → something went wrong
  - ping                 → keep-alive heartbeat every 25s
"""
from __future__ import annotations

import asyncio
import json
import logging

import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.redis_client import redis_manager

logger = logging.getLogger("hazardmap.ws")

try:
    import orjson
except ImportError:  # pragma: no cover - exercised only in lightweight test envs
    orjson = None

router = APIRouter()

# All currently connected browser clients
_CLIENTS: set[WebSocket] = set()
_CLIENT_LOCKS: dict[WebSocket, asyncio.Lock] = {}

MAX_CLIENTS = 10000  # Increased capacity guard


@router.websocket("/ws/live")
async def ws_live(ws: WebSocket):
    if len(_CLIENTS) >= MAX_CLIENTS:
        await ws.close(code=1008, reason="Server at capacity")
        return

    await ws.accept()
    _CLIENTS.add(ws)
    _CLIENT_LOCKS[ws] = asyncio.Lock()
    logger.info(f"[WS] Client connected. Total clients: {len(_CLIENTS)}")

    async def send_pings():
        try:
            while True:
                await asyncio.sleep(25)
                async with _CLIENT_LOCKS[ws]:
                    await ws.send_text('{"type":"ping"}')
        except Exception:
            pass

    ping_task = asyncio.create_task(send_pings())

    try:
        # Proper receive loop to detect disconnects instantly
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug(f"[WS] Client disconnected with error: {exc}")
    finally:
        ping_task.cancel()
        _CLIENTS.discard(ws)
        _CLIENT_LOCKS.pop(ws, None)
        logger.info(f"[WS] Client disconnected. Total clients: {len(_CLIENTS)}")


async def _send_safe(client: WebSocket, payload: str, dead: set[WebSocket]) -> None:
    try:
        lock = _CLIENT_LOCKS.get(client)
        if lock is None:
            dead.add(client)
            return
        async with lock:
            await client.send_text(payload)
    except Exception:
        dead.add(client)

async def redis_listener() -> None:
    """Phase 4 Cutover: Listen to Redis pub/sub and forward payloads to local clients."""
    logger.info("[WS] Starting Redis Pub/Sub listener...")
    while True:
        try:
            async for message in redis_manager.subscribe("ws_events"):
                if not isinstance(message, dict) or message.get("version") != "1.0":
                    logger.warning(f"[WS] Received invalid or incompatible message format from Redis: {message}")
                    continue
                    
                payload = message.get("payload")
                if payload:
                    await _broadcast_local(payload)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("[WS] Redis listener crashed; reconnecting soon: %s", exc)
            await asyncio.sleep(2)

async def broadcast(message: dict) -> None:
    """
    Phase 4 Cutover:
    Wrap the message in a versioned contract and push strictly into Redis.
    The redis_listener will handle local fan-out.
    """
    contract_payload = {
        "version": "1.0",
        "timestamp": time.time(),
        "payload": message
    }
    
    await redis_manager.publish("ws_events", contract_payload)
    
    # Fallback to local broadcast if Redis is strictly in mock/stub mode and not connected
    if not redis_manager._is_connected:
        await _broadcast_local(message)

async def _broadcast_local(message: dict) -> None:
    """
    Push a message to all connected browser clients concurrently.
    Dead connections are removed automatically.
    """
    if not _CLIENTS:
        return

    if orjson is not None:
        payload = orjson.dumps(message, default=str).decode("utf-8")
    else:
        payload = json.dumps(message, default=str)
    
    dead: set[WebSocket] = set()

    # Broadcast to all clients concurrently to prevent head-of-line blocking
    tasks = [_send_safe(client, payload, dead) for client in list(_CLIENTS)]
    if tasks:
        await asyncio.gather(*tasks)

    if dead:
        _CLIENTS.difference_update(dead)
        logger.debug(f"[WS] Removed {len(dead)} dead connection(s)")

    logger.debug(f"[WS] Broadcast type={message.get('type')} to {len(_CLIENTS)} clients")


def client_count() -> int:
    return len(_CLIENTS)
