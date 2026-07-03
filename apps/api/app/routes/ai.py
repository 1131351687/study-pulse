from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ai.config_store import AIConfig, read_ai_config, save_ai_config
from app.ai.daily_context import build_daily_context, today_string
from app.ai.providers import create_provider, test_provider_connection
from app.db import get_connection

router = APIRouter(tags=["ai"])


class DailyPlanRequest(BaseModel):
    date: str | None = None


class AIConfigRequest(BaseModel):
    provider: str
    endpoint: str = ""
    model: str = ""
    apiKey: str | None = None
    sendActivityTitles: bool = True


@router.get("/ai/config")
def read_config() -> dict[str, Any]:
    config = read_ai_config()
    return {
        "provider": config.provider,
        "endpoint": config.endpoint,
        "model": config.model,
        "sendActivityTitles": config.send_activity_titles,
        "hasApiKey": bool(config.api_key),
    }


@router.put("/ai/config")
def update_config(payload: AIConfigRequest) -> dict[str, Any]:
    current = read_ai_config()
    provider = payload.provider.strip().lower()
    if provider not in {"mock", "openai", "deepseek", "ollama"}:
        raise HTTPException(status_code=400, detail="Provider must be mock, openai, deepseek, or ollama.")

    api_key = current.api_key if payload.apiKey is None else payload.apiKey.strip()
    endpoint = _default_endpoint(provider, payload.endpoint.strip())
    model = _default_model(provider, payload.model.strip())
    config = save_ai_config(
        AIConfig(
            provider=provider,
            endpoint=endpoint,
            model=model,
            api_key=api_key,
            send_activity_titles=payload.sendActivityTitles,
        )
    )
    return {
        "provider": config.provider,
        "endpoint": config.endpoint,
        "model": config.model,
        "sendActivityTitles": config.send_activity_titles,
        "hasApiKey": bool(config.api_key),
    }


@router.post("/ai/test")
def test_config(payload: AIConfigRequest | None = None) -> dict[str, Any]:
    current = read_ai_config()
    if payload is None:
        config = current
    else:
        provider = payload.provider.strip().lower()
        if provider not in {"mock", "openai", "deepseek", "ollama"}:
            raise HTTPException(status_code=400, detail="Provider must be mock, openai, deepseek, or ollama.")
        config = AIConfig(
            provider=provider,
            endpoint=_default_endpoint(provider, payload.endpoint.strip()),
            model=_default_model(provider, payload.model.strip()),
            api_key=current.api_key if payload.apiKey is None else payload.apiKey.strip(),
            send_activity_titles=payload.sendActivityTitles,
        )
    return test_provider_connection(config.provider, config.endpoint, config.model, config.api_key)


@router.post("/ai/daily-plan")
def generate_daily_plan(payload: DailyPlanRequest) -> dict[str, Any]:
    config = read_ai_config()
    target_date = payload.date or today_string()
    context = build_daily_context(target_date)
    provider = create_provider(
        config.provider,
        config.endpoint,
        config.model,
        config.api_key,
    )

    try:
        result = provider.generate_daily_plan(context)
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    _save_generated_plan(target_date, config.provider, result)
    return {"date": target_date, "provider": config.provider, "result": result}


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


def _default_endpoint(provider: str, endpoint: str) -> str:
    if endpoint:
        return endpoint
    if provider == "openai":
        return "https://api.openai.com/v1"
    if provider == "deepseek":
        return "https://api.deepseek.com/v1"
    if provider == "ollama":
        return "http://localhost:11434"
    return ""


def _default_model(provider: str, model: str) -> str:
    if model:
        return model
    if provider == "openai":
        return "gpt-4.1-mini"
    if provider == "deepseek":
        return "deepseek-chat"
    if provider == "ollama":
        return "llama3.1"
    return ""
