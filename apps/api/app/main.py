from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routes import activity, ai, day_record, goals, health, history, journal, runtime, schedule, settings, tasks


def create_app() -> FastAPI:
    app_settings = get_settings()
    init_db()
    app = FastAPI(title=app_settings.app_name, version=app_settings.version)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(activity.router, prefix="/api")
    app.include_router(ai.router, prefix="/api")
    app.include_router(day_record.router, prefix="/api")
    app.include_router(goals.router, prefix="/api")
    app.include_router(history.router, prefix="/api")
    app.include_router(runtime.router, prefix="/api")
    app.include_router(journal.router, prefix="/api")
    app.include_router(tasks.router, prefix="/api")
    app.include_router(schedule.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")

    @app.get("/")
    def read_root() -> dict[str, str]:
        return {
            "name": app_settings.app_name,
            "status": "ok",
            "message": "StudyPulse API is running. Use /api/health for health checks.",
        }

    return app


app = create_app()
