from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_connection, rows_to_dicts

router = APIRouter(tags=["tasks"])

PlannedFor = Literal["today", "tomorrow", "week"]
Priority = Literal["low", "normal", "high"]


class TaskCreate(BaseModel):
    title: str
    plannedFor: PlannedFor = "today"
    area: str = ""
    priority: Priority = "normal"


class TaskUpdate(BaseModel):
    title: str | None = None
    completed: bool | None = None
    plannedFor: PlannedFor | None = None
    area: str | None = None
    priority: Priority | None = None


@router.get("/tasks")
def list_tasks() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, completed, planned_for, area, priority, created_at, updated_at
            FROM tasks
            ORDER BY completed ASC, id DESC
            """
        ).fetchall()
    return [_task_to_response(row) for row in rows_to_dicts(rows)]


@router.post("/tasks")
def create_task(payload: TaskCreate) -> dict:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Task title is required.")

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO tasks (title, planned_for, area, priority, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (title, payload.plannedFor, payload.area.strip(), payload.priority),
        )
        row = connection.execute(
            "SELECT id, title, completed, planned_for, area, priority, created_at, updated_at FROM tasks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _task_to_response(dict(row))


@router.patch("/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate) -> dict:
    updates: list[str] = []
    values: list[object] = []

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Task title is required.")
        updates.append("title = ?")
        values.append(title)
    if payload.completed is not None:
        updates.append("completed = ?")
        values.append(1 if payload.completed else 0)
    if payload.plannedFor is not None:
        updates.append("planned_for = ?")
        values.append(payload.plannedFor)
    if payload.area is not None:
        updates.append("area = ?")
        values.append(payload.area.strip())
    if payload.priority is not None:
        updates.append("priority = ?")
        values.append(payload.priority)

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        values.append(task_id)
        with get_connection() as connection:
            connection.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", values)
            row = connection.execute(
                "SELECT id, title, completed, planned_for, area, priority, created_at, updated_at FROM tasks WHERE id = ?",
                (task_id,),
            ).fetchone()
    else:
        with get_connection() as connection:
            row = connection.execute(
                "SELECT id, title, completed, planned_for, area, priority, created_at, updated_at FROM tasks WHERE id = ?",
                (task_id,),
            ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return _task_to_response(dict(row))


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int) -> dict[str, bool]:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task not found.")
    return {"deleted": True}


def _task_to_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "completed": bool(row["completed"]),
        "plannedFor": row["planned_for"],
        "area": row["area"],
        "priority": row["priority"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }

