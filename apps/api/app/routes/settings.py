from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["settings"])


@router.get("/settings")
def read_public_settings() -> dict[str, str | int | bool]:
    settings = get_settings()
    return {
        "activitywatchUrl": settings.activitywatch_url,
        "host": settings.host,
        "port": settings.port,
    }
