from __future__ import annotations

from dataclasses import dataclass

from app.config import get_settings
from app.db import get_connection


@dataclass(frozen=True)
class AIConfig:
    provider: str
    endpoint: str
    model: str
    api_key: str
    send_activity_titles: bool
    planning_prompt: str = ""
    summary_prompt: str = ""


def read_ai_config() -> AIConfig:
    settings = get_settings()
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT provider, endpoint, model, api_key, send_activity_titles, planning_prompt, summary_prompt
            FROM ai_config
            WHERE id = 1
            """
        ).fetchone()

    if row is None:
        return AIConfig(
            provider=settings.ai_provider,
            endpoint=settings.ai_endpoint,
            model=settings.ai_model,
            api_key=settings.ai_api_key,
            send_activity_titles=settings.ai_send_activity_titles,
        )

    return AIConfig(
        provider=row["provider"],
        endpoint=row["endpoint"],
        model=row["model"],
        api_key=row["api_key"],
        send_activity_titles=bool(row["send_activity_titles"]),
        planning_prompt=row["planning_prompt"],
        summary_prompt=row["summary_prompt"],
    )


def save_ai_config(config: AIConfig) -> AIConfig:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO ai_config (id, provider, endpoint, model, api_key, send_activity_titles, planning_prompt, summary_prompt, updated_at)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                provider = excluded.provider,
                endpoint = excluded.endpoint,
                model = excluded.model,
                api_key = excluded.api_key,
                send_activity_titles = excluded.send_activity_titles,
                planning_prompt = excluded.planning_prompt,
                summary_prompt = excluded.summary_prompt,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                config.provider,
                config.endpoint,
                config.model,
                config.api_key,
                1 if config.send_activity_titles else 0,
                config.planning_prompt,
                config.summary_prompt,
            ),
        )
    return config
