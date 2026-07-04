from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_connection, rows_to_dicts

router = APIRouter(tags=["goals"])


class GoalCreate(BaseModel):
    name: str
    description: str = ""
    currentFocus: str = ""
    active: bool = True


class GoalUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    currentFocus: str | None = None
    active: bool | None = None


@router.get("/goals")
def list_goals() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, name, description, current_focus, active, created_at, updated_at
            FROM learning_goals
            ORDER BY active DESC, id DESC
            """
        ).fetchall()
    return [_goal_to_response(row) for row in rows_to_dicts(rows)]


@router.post("/goals")
def create_goal(payload: GoalCreate) -> dict:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Goal name is required.")

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO learning_goals (name, description, current_focus, active, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (name, payload.description.strip(), payload.currentFocus.strip(), 1 if payload.active else 0),
        )
        row = connection.execute(
            "SELECT id, name, description, current_focus, active, created_at, updated_at FROM learning_goals WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _goal_to_response(dict(row))


@router.patch("/goals/{goal_id}")
def update_goal(goal_id: int, payload: GoalUpdate) -> dict:
    updates: list[str] = []
    values: list[object] = []

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Goal name is required.")
        updates.append("name = ?")
        values.append(name)
    if payload.description is not None:
        updates.append("description = ?")
        values.append(payload.description.strip())
    if payload.currentFocus is not None:
        updates.append("current_focus = ?")
        values.append(payload.currentFocus.strip())
    if payload.active is not None:
        updates.append("active = ?")
        values.append(1 if payload.active else 0)

    with get_connection() as connection:
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            values.append(goal_id)
            connection.execute(f"UPDATE learning_goals SET {', '.join(updates)} WHERE id = ?", values)
        row = connection.execute(
            "SELECT id, name, description, current_focus, active, created_at, updated_at FROM learning_goals WHERE id = ?",
            (goal_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return _goal_to_response(dict(row))


@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: int) -> dict[str, bool]:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM learning_goals WHERE id = ?", (goal_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return {"deleted": True}


def _goal_to_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "currentFocus": row["current_focus"],
        "active": bool(row["active"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }
