from __future__ import annotations

from datetime import date as date_type
from typing import Any

from fastapi import APIRouter, Query

from app.day_record import build_day_record, list_recent_day_records

router = APIRouter(tags=["day-record"])


@router.get("/day-record/{date}")
def read_day_record(date: str) -> dict[str, Any]:
    return build_day_record(date)


@router.get("/day-record")
def read_today_record() -> dict[str, Any]:
    return build_day_record(date_type.today().isoformat())


@router.get("/day-records/recent")
def read_recent_day_records(days: int = Query(default=14, ge=1, le=90)) -> list[dict[str, Any]]:
    return list_recent_day_records(days)
