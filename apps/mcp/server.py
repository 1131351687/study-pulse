"""StudyPulse MCP server.

Exposes StudyPulse data (journals, day records, goals, tasks, AI summaries)
as MCP tools so any MCP-compatible AI client can read and write learning data.

Run standalone:
    python -m apps.mcp.server
Or via the npm script:
    npm run mcp:server
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date as date_type
from pathlib import Path
from typing import Any

# Make the api package importable when running from project root
_api_dir = Path(__file__).resolve().parents[1] / "api"
if str(_api_dir) not in sys.path:
    sys.path.insert(0, str(_api_dir))

from mcp.server.fastmcp import FastMCP

from app.db import get_connection, init_db
from app.day_record import build_day_record, list_recent_day_records, read_goal


mcp = FastMCP("StudyPulse")


def _ensure_db() -> None:
    """Create tables if the database does not exist yet."""
    init_db()


def _today() -> str:
    return date_type.today().isoformat()


# Journal tools


@mcp.tool()
def read_journal(date: str | None = None) -> str:
    """Read the learning journal for a date (YYYY-MM-DD). Defaults to today.

    Returns the journal content and last-updated timestamp as JSON.
    """
    _ensure_db()
    target = date or _today()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT date, content, updated_at FROM journals WHERE date = ?",
            (target,),
        ).fetchone()
    if row is None:
        return json.dumps({"date": target, "content": "", "updatedAt": ""}, ensure_ascii=False)
    return json.dumps(
        {"date": row["date"], "content": row["content"], "updatedAt": row["updated_at"]},
        ensure_ascii=False,
    )


@mcp.tool()
def write_journal(content: str, date: str | None = None) -> str:
    """Write or overwrite the learning journal for a date (YYYY-MM-DD).

    Defaults to today. Returns the saved journal as JSON.
    """
    _ensure_db()
    target = date or _today()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO journals (date, content, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(date) DO UPDATE SET
                content = excluded.content,
                updated_at = CURRENT_TIMESTAMP
            """,
            (target, content),
        )
        row = conn.execute(
            "SELECT date, content, updated_at FROM journals WHERE date = ?",
            (target,),
        ).fetchone()
    return json.dumps(
        {"date": row["date"], "content": row["content"], "updatedAt": row["updated_at"]},
        ensure_ascii=False,
    )


# Day record tools


@mcp.tool()
def read_day_record(date: str | None = None) -> str:
    """Read the complete daily learning record for a date (YYYY-MM-DD).

    Includes journal, schedule blocks, ActivityWatch activity summary,
    AI summaries, and AI plans for that day. Defaults to today.
    """
    _ensure_db()
    target = date or _today()
    record = build_day_record(target)
    return json.dumps(record, ensure_ascii=False)


@mcp.tool()
def list_recent_records(days: int = 7) -> str:
    """List daily learning records for the past N days (default 7, max 90).

    Each record includes journal, schedule, activity, AI summaries, and plans.
    Useful for giving an AI client context about recent learning history.
    """
    _ensure_db()
    days = max(1, min(days, 90))
    records = list_recent_day_records(days)
    return json.dumps(records, ensure_ascii=False)


# Goal tools


@mcp.tool()
def list_goals() -> str:
    """List all learning goals, ordered by active first then newest.

    Returns an array of goal objects with id, name, description,
    currentFocus, active, and timestamps.
    """
    _ensure_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, description, current_focus, active,
                   created_at, updated_at
            FROM learning_goals
            ORDER BY active DESC, id DESC
            """,
        ).fetchall()
    goals = [
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "currentFocus": row["current_focus"],
            "active": bool(row["active"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]
    return json.dumps(goals, ensure_ascii=False)


@mcp.tool()
def create_goal(name: str, description: str = "", current_focus: str = "") -> str:
    """Create a new learning goal.

    Returns the created goal as JSON.
    """
    _ensure_db()
    name = name.strip()
    if not name:
        return json.dumps({"error": "Goal name is required."}, ensure_ascii=False)
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO learning_goals (name, description, current_focus, active, updated_at)
            VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
            """,
            (name, description.strip(), current_focus.strip()),
        )
        row = conn.execute(
            "SELECT id, name, description, current_focus, active, created_at, updated_at FROM learning_goals WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return json.dumps(
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "currentFocus": row["current_focus"],
            "active": bool(row["active"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        },
        ensure_ascii=False,
    )


# Milestone tools


@mcp.tool()
def list_milestones(goal_id: int) -> str:
    """List all milestones for a learning goal, ordered by position.

    Returns an array of milestone objects with id, goal_id, title,
    description, completed, position, and timestamps.
    """
    _ensure_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, goal_id, title, description, completed, position, created_at, updated_at FROM goal_milestones WHERE goal_id = ? ORDER BY position ASC, id ASC",
            (goal_id,),
        ).fetchall()
    milestones = [
        {
            "id": row["id"],
            "goalId": row["goal_id"],
            "title": row["title"],
            "description": row["description"],
            "completed": bool(row["completed"]),
            "position": row["position"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]
    return json.dumps(milestones, ensure_ascii=False)


@mcp.tool()
def create_milestone(goal_id: int, title: str, description: str = "") -> str:
    """Create a new milestone for a learning goal.

    Args:
        goal_id: ID of the parent learning goal.
        title: Milestone title.
        description: Optional description of the milestone.

    Returns the created milestone as JSON.
    """
    _ensure_db()
    title = title.strip()
    if not title:
        return json.dumps({"error": "Milestone title is required."}, ensure_ascii=False)
    with get_connection() as conn:
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM goal_milestones WHERE goal_id = ?",
            (goal_id,),
        ).fetchone()[0]
        cursor = conn.execute(
            "INSERT INTO goal_milestones (goal_id, title, description, position, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
            (goal_id, title, description.strip(), max_pos),
        )
        row = conn.execute(
            "SELECT id, goal_id, title, description, completed, position, created_at, updated_at FROM goal_milestones WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return json.dumps(
        {
            "id": row["id"],
            "goalId": row["goal_id"],
            "title": row["title"],
            "description": row["description"],
            "completed": bool(row["completed"]),
            "position": row["position"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        },
        ensure_ascii=False,
    )


@mcp.tool()
def update_milestone(milestone_id: int, title: str | None = None, description: str | None = None, completed: bool | None = None) -> str:
    """Update a milestone's title, description, or completion status.

    Args:
        milestone_id: ID of the milestone to update.
        title: New title (optional).
        description: New description (optional).
        completed: New completion status (optional).

    Returns the updated milestone as JSON.
    """
    _ensure_db()
    updates: list[str] = []
    values: list[object] = []

    if title is not None:
        t = title.strip()
        if not t:
            return json.dumps({"error": "Milestone title cannot be empty."}, ensure_ascii=False)
        updates.append("title = ?")
        values.append(t)
    if description is not None:
        updates.append("description = ?")
        values.append(description)
    if completed is not None:
        updates.append("completed = ?")
        values.append(1 if completed else 0)

    if not updates:
        return json.dumps({"error": "No fields to update."}, ensure_ascii=False)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(milestone_id)

    with get_connection() as conn:
        conn.execute(f"UPDATE goal_milestones SET {', '.join(updates)} WHERE id = ?", values)
        row = conn.execute(
            "SELECT id, goal_id, title, description, completed, position, created_at, updated_at FROM goal_milestones WHERE id = ?",
            (milestone_id,),
        ).fetchone()

    if row is None:
        return json.dumps({"error": "Milestone not found."}, ensure_ascii=False)
    return json.dumps(
        {
            "id": row["id"],
            "goalId": row["goal_id"],
            "title": row["title"],
            "description": row["description"],
            "completed": bool(row["completed"]),
            "position": row["position"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        },
        ensure_ascii=False,
    )


@mcp.tool()
def delete_milestone(milestone_id: int) -> str:
    """Delete a milestone by its ID.

    Returns {"deleted": true} on success.
    """
    _ensure_db()
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM goal_milestones WHERE id = ?", (milestone_id,))
    if cursor.rowcount == 0:
        return json.dumps({"error": "Milestone not found."}, ensure_ascii=False)
    return json.dumps({"deleted": True})


# Task tools


@mcp.tool()
def list_tasks() -> str:
    """List all tasks, ordered by incomplete first then newest.

    Returns an array of task objects.
    """
    _ensure_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, title, completed, planned_for, area, priority,
                   created_at, updated_at
            FROM tasks
            ORDER BY completed ASC, id DESC
            """,
        ).fetchall()
    tasks = [
        {
            "id": row["id"],
            "title": row["title"],
            "completed": bool(row["completed"]),
            "plannedFor": row["planned_for"],
            "area": row["area"],
            "priority": row["priority"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]
    return json.dumps(tasks, ensure_ascii=False)


@mcp.tool()
def create_task(title: str, planned_for: str = "today", area: str = "", priority: str = "normal") -> str:
    """Create a new task.

    Args:
        title: Task title.
        planned_for: One of 'today', 'tomorrow', 'week'. Default 'today'.
        area: Optional area/subject label.
        priority: One of 'low', 'normal', 'high'. Default 'normal'.

    Returns the created task as JSON.
    """
    _ensure_db()
    title = title.strip()
    if not title:
        return json.dumps({"error": "Task title is required."}, ensure_ascii=False)
    if planned_for not in ("today", "tomorrow", "week"):
        planned_for = "today"
    if priority not in ("low", "normal", "high"):
        priority = "normal"
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO tasks (title, planned_for, area, priority, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (title, planned_for, area.strip(), priority),
        )
        row = conn.execute(
            "SELECT id, title, completed, planned_for, area, priority, created_at, updated_at FROM tasks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return json.dumps(
        {
            "id": row["id"],
            "title": row["title"],
            "completed": bool(row["completed"]),
            "plannedFor": row["planned_for"],
            "area": row["area"],
            "priority": row["priority"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        },
        ensure_ascii=False,
    )


@mcp.tool()
def toggle_task(task_id: int) -> str:
    """Toggle a task's completion status by its ID.

    Returns the updated task as JSON.
    """
    _ensure_db()
    with get_connection() as conn:
        row = conn.execute("SELECT completed FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            return json.dumps({"error": "Task not found."}, ensure_ascii=False)
        new_state = 0 if row["completed"] else 1
        conn.execute("UPDATE tasks SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_state, task_id))
        row = conn.execute(
            "SELECT id, title, completed, planned_for, area, priority, created_at, updated_at FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
    return json.dumps(
        {
            "id": row["id"],
            "title": row["title"],
            "completed": bool(row["completed"]),
            "plannedFor": row["planned_for"],
            "area": row["area"],
            "priority": row["priority"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        },
        ensure_ascii=False,
    )


# AI summaries (read-only)


@mcp.tool()
def read_ai_summaries(date: str | None = None) -> str:
    """Read AI-generated daily summaries for a date (YYYY-MM-DD).

    Returns an array of summary records with score, strengths, blockers,
    and improvements. Defaults to today.
    """
    _ensure_db()
    target = date or _today()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, provider, score, content_json, created_at FROM ai_summaries WHERE date = ? ORDER BY id DESC",
            (target,),
        ).fetchall()
    summaries = []
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
    return json.dumps(summaries, ensure_ascii=False)


if __name__ == "__main__":
    _ensure_db()
    mcp.run()
