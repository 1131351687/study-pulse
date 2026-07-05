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
    activitywatch_url: str = "http://127.0.0.1:5600"
    database_path: Path = PROJECT_ROOT / "data" / "study-pulse.sqlite"
    runtime_state_path: Path = PROJECT_ROOT / "data" / "runtime-state.json"
    ai_provider: str = "mock"
    ai_endpoint: str = ""
    ai_model: str = ""
    ai_api_key: str = ""
    ai_send_activity_titles: bool = True


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
            "http://127.0.0.1:5600",
        ),
        database_path=Path(
            os.getenv("STUDY_PULSE_DB_PATH", str(PROJECT_ROOT / "data" / "study-pulse.sqlite"))
        ),
        runtime_state_path=Path(
            os.getenv("STUDY_PULSE_RUNTIME_STATE_PATH", str(PROJECT_ROOT / "data" / "runtime-state.json"))
        ),
        ai_provider=os.getenv("STUDY_PULSE_AI_PROVIDER", "mock"),
        ai_endpoint=os.getenv("STUDY_PULSE_AI_ENDPOINT", ""),
        ai_model=os.getenv("STUDY_PULSE_AI_MODEL", ""),
        ai_api_key=os.getenv("STUDY_PULSE_AI_API_KEY", ""),
        ai_send_activity_titles=os.getenv("STUDY_PULSE_AI_SEND_ACTIVITY_TITLES", "true").lower()
        in {"1", "true", "yes", "on"},
    )
