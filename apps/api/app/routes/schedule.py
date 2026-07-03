from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_connection, rows_to_dicts

router = APIRouter(tags=["schedule"])


class ScheduleCreate(BaseModel):
    date: str
    startTime: str
    endTime: str
    title: str


class ScheduleUpdate(BaseModel):
    startTime: str | None = None
    endTime: str | None = None
    title: str | None = None


@router.get("/schedule/{date}")
def list_schedule(date: str) -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, date, start_time, end_time, title, created_at, updated_at
            FROM schedule_blocks
            WHERE date = ?
            ORDER BY start_time ASC, id ASC
            """,
            (date,),
        ).fetchall()
    return [_schedule_to_response(row) for row in rows_to_dicts(rows)]


@router.post("/schedule")
def create_schedule_block(payload: ScheduleCreate) -> dict:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Schedule title is required.")

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO schedule_blocks (date, start_time, end_time, title, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (payload.date, payload.startTime, payload.endTime, title),
        )
        row = connection.execute(
            "SELECT id, date, start_time, end_time, title, created_at, updated_at FROM schedule_blocks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _schedule_to_response(dict(row))


@router.patch("/schedule/{block_id}")
def update_schedule_block(block_id: int, payload: ScheduleUpdate) -> dict:
    updates: list[str] = []
    values: list[object] = []

    if payload.startTime is not None:
        updates.append("start_time = ?")
        values.append(payload.startTime)
    if payload.endTime is not None:
        updates.append("end_time = ?")
        values.append(payload.endTime)
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Schedule title is required.")
        updates.append("title = ?")
        values.append(title)

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        values.append(block_id)
        with get_connection() as connection:
            connection.execute(f"UPDATE schedule_blocks SET {', '.join(updates)} WHERE id = ?", values)
            row = connection.execute(
                "SELECT id, date, start_time, end_time, title, created_at, updated_at FROM schedule_blocks WHERE id = ?",
                (block_id,),
            ).fetchone()
    else:
        with get_connection() as connection:
            row = connection.execute(
                "SELECT id, date, start_time, end_time, title, created_at, updated_at FROM schedule_blocks WHERE id = ?",
                (block_id,),
            ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Schedule block not found.")
    return _schedule_to_response(dict(row))


@router.delete("/schedule/{block_id}")
def delete_schedule_block(block_id: int) -> dict[str, bool]:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM schedule_blocks WHERE id = ?", (block_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Schedule block not found.")
    return {"deleted": True}


def _schedule_to_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "date": row["date"],
        "startTime": row["start_time"],
        "endTime": row["end_time"],
        "title": row["title"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }

