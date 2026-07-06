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


class MilestoneCreate(BaseModel):
    title: str
    description: str = ""


class MilestoneUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    completed: bool | None = None


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


# ── 里程碑 CRUD ──────────────────────────────────────


@router.get("/goals/{goal_id}/milestones")
def list_milestones(goal_id: int) -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, goal_id, title, description, completed, position, created_at, updated_at FROM goal_milestones WHERE goal_id = ? ORDER BY position ASC, id ASC",
            (goal_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@router.post("/goals/{goal_id}/milestones")
def create_milestone(goal_id: int, payload: MilestoneCreate) -> dict:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Milestone title is required.")

    with get_connection() as connection:
        # 获取下一个 position
        max_pos = connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM goal_milestones WHERE goal_id = ?",
            (goal_id,),
        ).fetchone()[0]
        cursor = connection.execute(
            "INSERT INTO goal_milestones (goal_id, title, description, position, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
            (goal_id, title, payload.description.strip(), max_pos),
        )
        row = connection.execute(
            "SELECT id, goal_id, title, description, completed, position, created_at, updated_at FROM goal_milestones WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return dict(row)


@router.patch("/goals/milestones/{milestone_id}")
def update_milestone(milestone_id: int, payload: MilestoneUpdate) -> dict:
    updates: list[str] = []
    values: list[object] = []

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Milestone title is required.")
        updates.append("title = ?")
        values.append(title)
    if payload.description is not None:
        updates.append("description = ?")
        values.append(payload.description)
    if payload.completed is not None:
        updates.append("completed = ?")
        values.append(1 if payload.completed else 0)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(milestone_id)

    with get_connection() as connection:
        connection.execute(f"UPDATE goal_milestones SET {', '.join(updates)} WHERE id = ?", values)
        row = connection.execute(
            "SELECT id, goal_id, title, description, completed, position, created_at, updated_at FROM goal_milestones WHERE id = ?",
            (milestone_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Milestone not found.")
    return dict(row)


@router.delete("/goals/milestones/{milestone_id}")
def delete_milestone(milestone_id: int) -> dict[str, bool]:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM goal_milestones WHERE id = ?", (milestone_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Milestone not found.")
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
