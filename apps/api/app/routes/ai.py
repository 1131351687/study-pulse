from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ai.daily_context import build_daily_context, today_string
from app.ai.providers import create_provider
from app.config import get_settings
from app.db import get_connection

router = APIRouter(tags=["ai"])


class DailyPlanRequest(BaseModel):
    date: str | None = None


@router.post("/ai/daily-plan")
def generate_daily_plan(payload: DailyPlanRequest) -> dict[str, Any]:
    settings = get_settings()
    target_date = payload.date or today_string()
    context = build_daily_context(target_date)
    provider = create_provider(
        settings.ai_provider,
        settings.ai_endpoint,
        settings.ai_model,
        settings.ai_api_key,
    )

    try:
        result = provider.generate_daily_plan(context)
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    _save_generated_plan(target_date, settings.ai_provider, result)
    return {"date": target_date, "provider": settings.ai_provider, "result": result}


@router.get("/ai/daily-plan/{date}")
def read_daily_plan(date: str) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT date, provider, content_json, updated_at FROM generated_plans WHERE date = ?",
            (date,),
        ).fetchone()
    if row is None:
        return {"date": date, "provider": "", "result": None, "updatedAt": ""}
    return {
        "date": row["date"],
        "provider": row["provider"],
        "result": json.loads(row["content_json"]),
        "updatedAt": row["updated_at"],
    }


def _save_generated_plan(target_date: str, provider: str, result: dict[str, Any]) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO generated_plans (date, provider, content_json, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(date) DO UPDATE SET
                provider = excluded.provider,
                content_json = excluded.content_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (target_date, provider, json.dumps(result, ensure_ascii=False)),
        )
