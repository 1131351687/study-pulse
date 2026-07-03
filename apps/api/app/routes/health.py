from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def read_health() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "appName": settings.app_name,
        "version": settings.version,
        "environment": settings.environment,
    }
