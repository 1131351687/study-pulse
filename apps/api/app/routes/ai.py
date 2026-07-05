from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ai.config_store import AIConfig, read_ai_config, save_ai_config
from app.ai.daily_context import build_daily_context, today_string
from app.ai.providers import create_provider, request_json_response, test_provider_connection
from app.day_record import build_day_record, list_recent_day_records, read_goal
from app.db import get_connection

router = APIRouter(tags=["ai"])


class DailyPlanRequest(BaseModel):
    date: str | None = None


class SummaryRequest(BaseModel):
    date: str | None = None


class GoalPlanRequest(BaseModel):
    date: str | None = None
    goalId: int


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


@router.post("/ai/summary")
def generate_summary(payload: SummaryRequest) -> dict[str, Any]:
    config = read_ai_config()
    target_date = payload.date or today_string()
    day_record = build_day_record(target_date)

    if config.provider == "mock":
        result = _mock_summary(day_record)
    else:
        result = _normalize_summary(
            request_json_response(
                config.provider,
                config.endpoint,
                config.model,
                config.api_key,
                (
                    "You summarize one study day. Return only JSON with keys: "
                    "score, summary, strengths, blockers, improvements."
                ),
                day_record,
            )
        )

    summary_id, created_at = _save_summary(target_date, config.provider, result)
    return {"id": summary_id, "date": target_date, "provider": config.provider, "result": result, "createdAt": created_at}


@router.get("/ai/summary/{date}")
def read_summaries(date: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, provider, score, content_json, created_at FROM ai_summaries WHERE date = ? ORDER BY id DESC",
            (date,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "provider": row["provider"],
            "score": row["score"],
            "result": json.loads(row["content_json"]),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


@router.delete("/ai/summary-record/{summary_id}")
def delete_summary(summary_id: int) -> dict[str, bool]:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM ai_summaries WHERE id = ?", (summary_id,))
    return {"deleted": cursor.rowcount > 0}


@router.post("/ai/plan")
def generate_goal_plan(payload: GoalPlanRequest) -> dict[str, Any]:
    config = read_ai_config()
    target_date = payload.date or today_string()
    goal = read_goal(payload.goalId)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found.")
    if not goal["active"]:
        raise HTTPException(status_code=400, detail="Goal is inactive.")

    context = {
        "date": target_date,
        "goal": goal,
        "todayRecord": build_day_record(target_date),
        "recentRecords": list_recent_day_records(7),
    }

    if config.provider == "mock":
        result = _mock_goal_plan(context)
    else:
        result = _normalize_goal_plan(
            request_json_response(
                config.provider,
                config.endpoint,
                config.model,
                config.api_key,
                (
                    "You create a study plan for one learning goal. Return only JSON with keys: "
                    "todayPlan, weekPlan, suggestedTasks."
                ),
                context,
            )
        )

    created_tasks: list[dict[str, Any]] = []
    goal_name = goal["name"]
    with get_connection() as connection:
        for task in result.get("suggestedTasks", []):
            planned_for = str(task.get("plannedFor") or "today")
            if planned_for != "today":
                continue
            title = str(task.get("title") or "").strip()
            if not title:
                continue
            cursor = connection.execute(
                "INSERT INTO tasks (title, planned_for, area, priority, updated_at) VALUES (?, 'today', ?, 'normal', CURRENT_TIMESTAMP)",
                (title, goal_name),
            )
            task_row = connection.execute(
                "SELECT id, title, completed, planned_for, area, priority, created_at, updated_at FROM tasks WHERE id = ?",
                (cursor.lastrowid,),
            ).fetchone()
            created_tasks.append({
                "id": task_row["id"],
                "title": task_row["title"],
                "completed": bool(task_row["completed"]),
                "plannedFor": task_row["planned_for"],
                "area": task_row["area"],
                "priority": task_row["priority"],
                "createdAt": task_row["created_at"],
                "updatedAt": task_row["updated_at"],
            })
    return {"tasks": created_tasks}


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


def _save_summary(target_date: str, provider: str, result: dict[str, Any]) -> tuple[int, str]:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO ai_summaries (date, provider, score, content_json) VALUES (?, ?, ?, ?)",
            (target_date, provider, int(result.get("score") or 0), json.dumps(result, ensure_ascii=False)),
        )
        row = connection.execute("SELECT id, created_at FROM ai_summaries WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return int(row["id"]), str(row["created_at"])


def _normalize_summary(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "score": _bounded_score(payload.get("score")),
        "summary": str(payload.get("summary") or "").strip(),
        "strengths": _string_list(_as_list(payload.get("strengths"))),
        "blockers": _string_list(_as_list(payload.get("blockers"))),
        "improvements": _string_list(_as_list(payload.get("improvements"))),
    }


def _normalize_goal_plan(payload: dict[str, Any]) -> dict[str, Any]:
    tasks = _as_list(payload.get("suggestedTasks"))
    return {
        "todayPlan": _string_list(_as_list(payload.get("todayPlan"))),
        "weekPlan": _string_list(_as_list(payload.get("weekPlan"))),
        "suggestedTasks": [
            {
                "title": str(task.get("title") or "").strip(),
                "reason": str(task.get("reason") or "").strip(),
                "plannedFor": str(task.get("plannedFor") or "today").strip(),
            }
            for task in (_coerce_task(task) for task in tasks)
            if str(task.get("title") or "").strip()
        ],
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _as_list(value: Any) -> list[Any]:
    """Coerce scalars and dicts into list form so normalizers stay tolerant."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        return [stripped] if stripped else []
    return [value]


def _coerce_task(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    title = str(value).strip() if value is not None else ""
    return {"title": title, "reason": "", "plannedFor": "today"}


def _bounded_score(value: Any) -> int:
    try:
        return max(0, min(int(value), 100))
    except (TypeError, ValueError):
        return 0


def _mock_summary(day_record: dict[str, Any]) -> dict[str, Any]:
    tracked_seconds = float(day_record.get("activity", {}).get("totalSeconds") or 0)
    journal = day_record.get("journal", {}).get("content") or ""
    score = 78 if tracked_seconds > 3600 else 62
    return {
        "score": score,
        "summary": f"Tracked {round(tracked_seconds / 60)} minutes. Journal focus: {journal[:120] or 'No journal yet.'}",
        "strengths": ["Kept a visible study record.", "Has a concrete day-level learning trail."],
        "blockers": ["Need clearer task follow-through."] if not day_record.get("scheduleBlocks") else ["Review whether schedule blocks matched actual work."],
        "improvements": ["Write one sharper end-of-day note.", "Carry one specific task into tomorrow."],
    }


def _mock_goal_plan(context: dict[str, Any]) -> dict[str, Any]:
    goal = context["goal"]
    focus = goal.get("currentFocus") or goal.get("name")
    return {
        "todayPlan": [
            f"Read or practice one focused unit for {focus}.",
            f"Write one short note that explains today's learning about {focus}.",
        ],
        "weekPlan": [
            f"Break {goal['name']} into three concrete subtopics.",
            "Reserve at least three study blocks this week.",
        ],
        "suggestedTasks": [
            {"title": f"Study {focus}", "reason": "Main active learning target.", "plannedFor": "today"},
            {"title": f"Write notes for {goal['name']}", "reason": "Turn study into a durable record.", "plannedFor": "today"},
        ],
    }


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
