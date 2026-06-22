"""Small shared report helpers for hazard plugins."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def build_hazard_report(
    *,
    hazard_type: str,
    result: dict[str, Any],
    summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "hazard_type": hazard_type,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {key: value for key, value in (summary or {}).items() if value is not None},
        "result": result,
    }
