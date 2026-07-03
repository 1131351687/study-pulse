from __future__ import annotations

import json
from datetime import date as date_type, timedelta
from typing import Any

from fastapi import APIRouter, Query

from app.activity.activitywatch import ActivityWatchClient
from app.config import get_settings
from app.db import get_connection

router = APIRouter(tags=["history"])


@router.get("/history/days")
def list_history_days(days: int = Query(default=14, ge=1, le=90)) -> list[dict[str, Any]]:
    settings = get_settings()
    today = date_type.today()
    dates = [(today - timedelta(days=offset)).isoformat() for offset in range(days)]
    journals = _read_journals(dates)
    schedules = _read_schedules(dates)
    plans = _read_generated_plans(dates)
    activity_client = ActivityWatchClient(settings.activitywatch_url)

    entries: list[dict[str, Any]] = []
    for target_date in dates:
        activity = activity_client.day_summary(target_date).to_dict()
        journal = journals.get(target_date, {"content": "", "updatedAt": ""})
        plan = plans.get(target_date)
        entries.append(
            {
                "date": target_date,
                "journalPreview": _preview(journal["content"]),
                "journalUpdatedAt": journal["updatedAt"],
                "scheduleBlocks": schedules.get(target_date, []),
                "hasPlan": plan is not None,
                "planProvider": plan["provider"] if plan else "",
                "planSummary": _preview(plan["summary"]) if plan else "",
                "activityAvailable": activity["available"],
                "trackedSeconds": activity["totalSeconds"],
            }
        )
    return entries


def _read_journals(dates: list[str]) -> dict[str, dict[str, str]]:
    placeholders = ",".join("?" for _ in dates)
    with get_connection() as connection:
        rows = connection.execute(
            f"SELECT date, content, updated_at FROM journals WHERE date IN ({placeholders})",
            dates,
        ).fetchall()
    return {
        row["date"]: {"content": row["content"], "updatedAt": row["updated_at"]}
        for row in rows
    }


def _read_schedules(dates: list[str]) -> dict[str, list[dict[str, str]]]:
    placeholders = ",".join("?" for _ in dates)
    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT date, start_time, end_time, title
            FROM schedule_blocks
            WHERE date IN ({placeholders})
            ORDER BY date DESC, start_time ASC, id ASC
            """,
            dates,
        ).fetchall()

    by_date: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        by_date.setdefault(row["date"], []).append(
            {
                "startTime": row["start_time"],
                "endTime": row["end_time"],
                "title": row["title"],
            }
        )
    return by_date


def _read_generated_plans(dates: list[str]) -> dict[str, dict[str, str]]:
    placeholders = ",".join("?" for _ in dates)
    with get_connection() as connection:
        rows = connection.execute(
            f"SELECT date, provider, content_json FROM generated_plans WHERE date IN ({placeholders})",
            dates,
        ).fetchall()

    plans: dict[str, dict[str, str]] = {}
    for row in rows:
        try:
            content = json.loads(row["content_json"])
        except json.JSONDecodeError:
            content = {}
        plans[row["date"]] = {
            "provider": row["provider"],
            "summary": str(content.get("summary") or ""),
        }
    return plans


def _preview(value: str, limit: int = 180) -> str:
    compact = " ".join(value.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit]}..."
