from pydantic import BaseModel
from fastapi import APIRouter

from app.db import get_connection

router = APIRouter(tags=["journal"])


class JournalPayload(BaseModel):
    content: str = ""


@router.get("/journal/{date}")
def read_journal(date: str) -> dict[str, str]:
    with get_connection() as connection:
        row = connection.execute("SELECT date, content, updated_at FROM journals WHERE date = ?", (date,)).fetchone()
    if row is None:
        return {"date": date, "content": "", "updatedAt": ""}
    return {"date": row["date"], "content": row["content"], "updatedAt": row["updated_at"]}


@router.put("/journal/{date}")
def save_journal(date: str, payload: JournalPayload) -> dict[str, str]:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO journals (date, content, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(date) DO UPDATE SET
                content = excluded.content,
                updated_at = CURRENT_TIMESTAMP
            """,
            (date, payload.content),
        )
        row = connection.execute("SELECT date, content, updated_at FROM journals WHERE date = ?", (date,)).fetchone()
    return {"date": row["date"], "content": row["content"], "updatedAt": row["updated_at"]}

