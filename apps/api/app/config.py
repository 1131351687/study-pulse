from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    app_name: str = "StudyPulse"
    version: str = "0.1.0"
    environment: str = "development"
    host: str = "127.0.0.1"
    port: int = 7788
    activitywatch_url: str = "http://localhost:5600"
    database_path: Path = PROJECT_ROOT / "data" / "study-pulse.sqlite"


def _read_port(value: str | None, fallback: int) -> int:
    if not value:
        return fallback
    try:
        return int(value)
    except ValueError:
        return fallback


@lru_cache
def get_settings() -> Settings:
    return Settings(
        environment=os.getenv("STUDY_PULSE_ENV", "development"),
        host=os.getenv("STUDY_PULSE_HOST", "127.0.0.1"),
        port=_read_port(os.getenv("STUDY_PULSE_PORT"), 7788),
        activitywatch_url=os.getenv(
            "STUDY_PULSE_ACTIVITYWATCH_URL",
            "http://localhost:5600",
        ),
        database_path=Path(
            os.getenv("STUDY_PULSE_DB_PATH", str(PROJECT_ROOT / "data" / "study-pulse.sqlite"))
        ),
    )
