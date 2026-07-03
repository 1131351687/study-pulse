from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import health, settings


def create_app() -> FastAPI:
    app_settings = get_settings()
    app = FastAPI(title=app_settings.app_name, version=app_settings.version)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    return app


app = create_app()
