from __future__ import annotations

import json

try:
    import orjson
except ImportError:  # pragma: no cover - lightweight test env fallback
    orjson = None

from app.models.database import get_conn


def _dumps(value) -> str:
    if orjson is not None:
        return orjson.dumps(value, default=str).decode("utf-8")
    return json.dumps(value, default=str)


def create_simulation_job(request_id: str, payload: dict) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO simulation_jobs (request_id, status, payload_json)
                VALUES (%s, 'queued', %s)
                ON CONFLICT (request_id) DO UPDATE
                SET status = 'queued',
                    payload_json = EXCLUDED.payload_json,
                    error = NULL,
                    updated_at = NOW()
                """,
                (request_id, _dumps(payload)),
            )


def mark_simulation_job_running(request_id: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE simulation_jobs
                SET status = 'running', updated_at = NOW()
                WHERE request_id = %s
                """,
                (request_id,),
            )


def mark_simulation_job_completed(request_id: str, result: dict) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE simulation_jobs
                SET status = 'completed',
                    simulation_id = %s,
                    result_json = %s,
                    error = NULL,
                    updated_at = NOW()
                WHERE request_id = %s
                """,
                (result.get("simulation_id"), _dumps(result), request_id),
            )


def mark_simulation_job_failed(request_id: str, error: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE simulation_jobs
                SET status = 'failed', error = %s, updated_at = NOW()
                WHERE request_id = %s
                """,
                (error, request_id),
            )


def get_simulation_job(request_id: str) -> dict | None:
    import psycopg2.extras

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT request_id, status, simulation_id, result_json, error,
                       created_at, updated_at
                FROM simulation_jobs
                WHERE request_id = %s
                """,
                (request_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
