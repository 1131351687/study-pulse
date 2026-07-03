from __future__ import annotations

from datetime import date as date_type

from app.activity.activitywatch import ActivityWatchClient
from app.config import get_settings
from app.db import get_connection, rows_to_dicts


def build_daily_context(target_date: str) -> dict:
    settings = get_settings()
    journal = _read_journal(target_date)
    tasks = _read_tasks()
    schedule = _read_schedule(target_date)
    activity = ActivityWatchClient(settings.activitywatch_url).day_summary(target_date)
    activity_payload = activity.to_dict()

    if not settings.ai_send_activity_titles:
        activity_payload["topTitles"] = []

    return {
        "date": target_date,
        "journal": journal,
        "tasks": tasks,
        "schedule": schedule,
        "activityAvailable": activity_payload["available"],
        "trackedDuration": _format_duration(activity_payload["totalSeconds"]),
        "topApps": activity_payload["topApps"],
        "topTitles": activity_payload["topTitles"],
    }


def today_string() -> str:
    return date_type.today().isoformat()


def _read_journal(target_date: str) -> str:
    with get_connection() as connection:
        row = connection.execute("SELECT content FROM journals WHERE date = ?", (target_date,)).fetchone()
    return row["content"] if row else ""


def _read_tasks() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, title, completed, planned_for, area, priority FROM tasks ORDER BY completed ASC, id DESC"
        ).fetchall()
    tasks = rows_to_dicts(rows)
    for task in tasks:
        task["completed"] = bool(task["completed"])
        task["plannedFor"] = task.pop("planned_for")
    return tasks


def _read_schedule(target_date: str) -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, start_time, end_time, title
            FROM schedule_blocks
            WHERE date = ?
            ORDER BY start_time ASC, id ASC
            """,
            (target_date,),
        ).fetchall()
    schedule = rows_to_dicts(rows)
    for block in schedule:
        block["startTime"] = block.pop("start_time")
        block["endTime"] = block.pop("end_time")
    return schedule


def _format_duration(seconds: float) -> str:
    minutes = round(seconds / 60)
    hours = minutes // 60
    rest = minutes % 60
    if hours <= 0:
        return f"{rest}m"
    if rest == 0:
        return f"{hours}h"
    return f"{hours}h {rest}m"
