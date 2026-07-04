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

    plan_id, _created_at = _save_goal_plan(target_date, payload.goalId, config.provider, result)
    plan = _read_plan_record(plan_id)
    if plan is None:
        raise HTTPException(status_code=500, detail="Generated plan could not be reloaded.")
    return plan


@router.get("/ai/plan/{date}/{goal_id}")
def read_goal_plans(date: str, goal_id: int) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, date, goal_id, provider, content_json, created_at FROM ai_plans WHERE date = ? AND goal_id = ? ORDER BY id DESC",
            (date, goal_id),
        ).fetchall()
    plan_ids = [int(row["id"]) for row in rows]
    suggestions_by_plan = _read_plan_suggestions(plan_ids)
    return [_plan_row_to_response(row, suggestions_by_plan.get(int(row["id"]), [])) for row in rows]


@router.post("/ai/plan/{plan_id}/accept-task/{suggestion_id}")
def accept_suggested_task(plan_id: int, suggestion_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        suggestion = connection.execute(
            """
            SELECT s.id, s.title, s.reason, s.planned_for, s.accepted, s.accepted_task_id, p.goal_id, g.name AS goal_name
            FROM ai_plan_suggested_tasks s
            JOIN ai_plans p ON p.id = s.plan_id
            JOIN learning_goals g ON g.id = p.goal_id
            WHERE s.id = ? AND s.plan_id = ?
            """,
            (suggestion_id, plan_id),
        ).fetchone()
        if suggestion is None:
            raise HTTPException(status_code=404, detail="Suggested task not found.")
        if suggestion["accepted"]:
            raise HTTPException(status_code=400, detail="Suggested task has already been accepted.")
        cursor = connection.execute(
            """
            INSERT INTO tasks (title, planned_for, area, priority, updated_at)
            VALUES (?, ?, ?, 'normal', CURRENT_TIMESTAMP)
            """,
            (suggestion["title"], suggestion["planned_for"], suggestion["goal_name"]),
        )
        task_row = connection.execute(
            "SELECT id, title, completed, planned_for, area, priority, created_at, updated_at FROM tasks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        connection.execute(
            "UPDATE ai_plan_suggested_tasks SET accepted = 1, accepted_task_id = ? WHERE id = ?",
            (cursor.lastrowid, suggestion_id),
        )
    return {
        "task": {
            "id": task_row["id"],
            "title": task_row["title"],
            "completed": bool(task_row["completed"]),
            "plannedFor": task_row["planned_for"],
            "area": task_row["area"],
            "priority": task_row["priority"],
            "createdAt": task_row["created_at"],
            "updatedAt": task_row["updated_at"],
        }
    }


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


def _save_goal_plan(target_date: str, goal_id: int, provider: str, result: dict[str, Any]) -> tuple[int, str]:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO ai_plans (date, goal_id, provider, content_json) VALUES (?, ?, ?, ?)",
            (target_date, goal_id, provider, json.dumps(result, ensure_ascii=False)),
        )
        plan_id = int(cursor.lastrowid)
        for task in result.get("suggestedTasks", []):
            connection.execute(
                """
                INSERT INTO ai_plan_suggested_tasks (plan_id, title, reason, planned_for)
                VALUES (?, ?, ?, ?)
                """,
                (plan_id, str(task.get("title") or ""), str(task.get("reason") or ""), str(task.get("plannedFor") or "today")),
            )
        row = connection.execute("SELECT id, created_at FROM ai_plans WHERE id = ?", (plan_id,)).fetchone()
    return int(row["id"]), str(row["created_at"])


def _read_plan_record(plan_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, date, goal_id, provider, content_json, created_at FROM ai_plans WHERE id = ?",
            (plan_id,),
        ).fetchone()
    if row is None:
        return None
    suggestions = _read_plan_suggestions([plan_id]).get(plan_id, [])
    return _plan_row_to_response(row, suggestions)


def _read_plan_suggestions(plan_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not plan_ids:
        return {}
    placeholders = ",".join("?" for _ in plan_ids)
    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT id, plan_id, title, reason, planned_for, accepted, accepted_task_id, created_at
            FROM ai_plan_suggested_tasks
            WHERE plan_id IN ({placeholders})
            ORDER BY id ASC
            """,
            plan_ids,
        ).fetchall()

    suggestions: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        plan_id = int(row["plan_id"])
        suggestions.setdefault(plan_id, []).append(
            {
                "id": row["id"],
                "title": row["title"],
                "reason": row["reason"],
                "plannedFor": row["planned_for"],
                "accepted": bool(row["accepted"]),
                "acceptedTaskId": row["accepted_task_id"],
                "createdAt": row["created_at"],
            }
        )
    return suggestions


def _plan_row_to_response(row: Any, suggestions: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        result = json.loads(row["content_json"])
    except json.JSONDecodeError:
        result = {}

    return {
        "id": row["id"],
        "date": row["date"],
        "goalId": row["goal_id"],
        "provider": row["provider"],
        "result": {
            **result,
            "suggestedTasks": suggestions,
        },
        "createdAt": row["created_at"],
    }


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
