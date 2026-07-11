from __future__ import annotations

import json
from datetime import date as date_type, timedelta
from typing import Any

from app.activity.activitywatch import ActivityWatchClient
from app.config import get_settings
from app.db import get_connection


def build_day_record(target_date: str, include_activity: bool = True) -> dict[str, Any]:
    settings = get_settings()
    activity = (
        ActivityWatchClient(settings.activitywatch_url).day_summary(target_date).to_dict()
        if include_activity
        else {"available": False, "message": "Skipped for batch query.", "totalSeconds": 0, "bucketCount": 0, "topApps": [], "topTitles": []}
    )
    journal = _read_journal(target_date)
    schedule_blocks = _read_schedule_blocks(target_date)
    summaries = _read_ai_summaries(target_date)
    tasks = _read_tasks(target_date)

    return {
        "date": target_date,
        "journal": journal,
        "scheduleBlocks": schedule_blocks,
        "activity": activity,
        "aiSummaries": summaries,
        "tasks": tasks,
    }


def list_recent_day_records(days: int) -> list[dict[str, Any]]:
    today = date_type.today()
    return [build_day_record((today - timedelta(days=offset)).isoformat(), include_activity=False) for offset in range(days)]


def read_goal(goal_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, name, description, current_focus, active, created_at, updated_at FROM learning_goals WHERE id = ?",
            (goal_id,),
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "currentFocus": row["current_focus"],
        "active": bool(row["active"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _read_journal(target_date: str) -> dict[str, str]:
    with get_connection() as connection:
        row = connection.execute("SELECT date, content, updated_at FROM journals WHERE date = ?", (target_date,)).fetchone()
    if row is None:
        return {"date": target_date, "content": "", "updatedAt": ""}
    return {"date": row["date"], "content": row["content"], "updatedAt": row["updated_at"]}


def _read_schedule_blocks(target_date: str) -> list[dict[str, str]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, start_time, end_time, title, created_at, updated_at
            FROM schedule_blocks
            WHERE date = ?
            ORDER BY start_time ASC, id ASC
            """,
            (target_date,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "startTime": row["start_time"],
            "endTime": row["end_time"],
            "title": row["title"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]


def _read_ai_summaries(target_date: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, provider, score, content_json, created_at FROM ai_summaries WHERE date = ? ORDER BY id DESC",
            (target_date,),
        ).fetchall()
    summaries: list[dict[str, Any]] = []
    for row in rows:
        try:
            result = json.loads(row["content_json"])
        except json.JSONDecodeError:
            result = {}
        summaries.append(
            {
                "id": row["id"],
                "provider": row["provider"],
                "score": row["score"],
                "result": result,
                "createdAt": row["created_at"],
            }
        )
    return summaries


def _read_tasks(target_date: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, title, completed, planned_for, for_date, area, priority, created_at, updated_at FROM tasks WHERE for_date = ? ORDER BY completed ASC, id DESC",
            (target_date,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "completed": bool(row["completed"]),
            "plannedFor": row["planned_for"],
            "forDate": row["for_date"],
            "area": row["area"],
            "priority": row["priority"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]
