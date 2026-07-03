from fastapi import APIRouter

from app.activity.activitywatch import ActivityWatchClient
from app.config import get_settings

router = APIRouter(tags=["activity"])


@router.get("/activity/today")
def read_today_activity() -> dict:
    settings = get_settings()
    client = ActivityWatchClient(settings.activitywatch_url)
    return client.today_summary().to_dict()

