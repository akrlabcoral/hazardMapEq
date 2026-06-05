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

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("hazardmap.ws")

router = APIRouter()

# All currently connected browser clients
_CLIENTS: set[WebSocket] = set()

MAX_CLIENTS = 100  # simple DoS guard


@router.websocket("/ws/live")
async def ws_live(ws: WebSocket):
    if len(_CLIENTS) >= MAX_CLIENTS:
        await ws.close(code=1008, reason="Server at capacity")
        return

    await ws.accept()
    _CLIENTS.add(ws)
    logger.info(f"[WS] Client connected. Total clients: {len(_CLIENTS)}")

    try:
        while True:
            # Send heartbeat every 25s to keep connection alive through proxies
            await asyncio.sleep(25)
            await ws.send_text('{"type":"ping"}')
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug(f"[WS] Client disconnected with error: {exc}")
    finally:
        _CLIENTS.discard(ws)
        logger.info(f"[WS] Client disconnected. Total clients: {len(_CLIENTS)}")


async def broadcast(message: dict) -> None:
    """
    Push a message to all connected browser clients.
    Dead connections are removed automatically.
    """
    if not _CLIENTS:
        return

    payload = json.dumps(message, default=str)
    dead: set[WebSocket] = set()

    for client in _CLIENTS:
        try:
            await client.send_text(payload)
        except Exception:
            dead.add(client)

    _CLIENTS.difference_update(dead)

    if dead:
        logger.debug(f"[WS] Removed {len(dead)} dead connection(s)")

    logger.debug(f"[WS] Broadcast type={message.get('type')} to {len(_CLIENTS)} clients")


def client_count() -> int:
    return len(_CLIENTS)
