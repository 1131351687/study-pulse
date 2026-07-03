from __future__ import annotations

import json
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class AIProvider(Protocol):
    def generate_daily_plan(self, context: dict[str, Any]) -> dict[str, Any]:
        ...


class MockAIProvider:
    def generate_daily_plan(self, context: dict[str, Any]) -> dict[str, Any]:
        journal = context.get("journal") or "No journal written yet."
        tasks = context.get("tasks") or []
        incomplete = [task for task in tasks if not task.get("completed")]
        topics = _infer_topics(journal, context)

        return _normalize_plan({
            "summary": f"Today has {context.get('trackedDuration', '0m')} of tracked computer activity. Journal note: {journal[:180]}",
            "topics": topics,
            "timeInsights": [
                "ActivityWatch data is available for time review." if context.get("activityAvailable") else "ActivityWatch data was unavailable.",
                "Use the journal to correct anything the activity titles cannot explain.",
            ],
            "unfinishedReasons": [
                f"{len(incomplete)} task(s) are still open; consider narrowing tomorrow's focus."
                if incomplete
                else "No unfinished tasks are recorded yet.",
            ],
            "suggestedTasks": [
                {
                    "title": task.get("title", "Continue task"),
                    "plannedFor": "tomorrow",
                    "reason": "Carried forward from unfinished work.",
                }
                for task in incomplete[:3]
            ],
            "tomorrowSchedule": [
                {"startTime": "09:00", "endTime": "10:30", "title": "Deep learning block"},
                {"startTime": "20:00", "endTime": "20:20", "title": "Daily review"},
            ],
        })


class OpenAICompatibleProvider:
    def __init__(self, endpoint: str, model: str, api_key: str) -> None:
        self.endpoint = endpoint.rstrip("/") or "https://api.openai.com/v1"
        self.model = model or "gpt-4.1-mini"
        self.api_key = api_key

    def generate_daily_plan(self, context: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("STUDY_PULSE_AI_API_KEY is required for the OpenAI-compatible provider.")

        payload = {
            "model": self.model,
            "messages": _messages(context),
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        response = _post_json(
            f"{self.endpoint}/chat/completions",
            payload,
            {"Authorization": f"Bearer {self.api_key}"},
        )
        content = response["choices"][0]["message"]["content"]
        return _normalize_plan(_parse_json_content(content))


class OllamaProvider:
    def __init__(self, endpoint: str, model: str) -> None:
        self.endpoint = endpoint.rstrip("/") or "http://localhost:11434"
        self.model = model or "llama3.1"

    def generate_daily_plan(self, context: dict[str, Any]) -> dict[str, Any]:
        payload = {"model": self.model, "messages": _messages(context), "stream": False, "format": "json"}
        response = _post_json(f"{self.endpoint}/api/chat", payload, {})
        content = response["message"]["content"]
        return _normalize_plan(_parse_json_content(content))


def create_provider(provider: str, endpoint: str, model: str, api_key: str) -> AIProvider:
    match provider.lower():
        case "openai":
            return OpenAICompatibleProvider(endpoint, model, api_key)
        case "ollama":
            return OllamaProvider(endpoint, model)
        case _:
            return MockAIProvider()


def _messages(context: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You generate concise learning summaries and next-day plans. "
                "Return only JSON with keys: summary, topics, timeInsights, unfinishedReasons, "
                "suggestedTasks, tomorrowSchedule."
            ),
        },
        {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
    ]


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json", **headers},
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        raise ValueError(f"AI provider request failed: {error}") from error


def _parse_json_content(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start : end + 1])
        raise


def _normalize_plan(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": _as_text(plan.get("summary")),
        "topics": _as_string_list(plan.get("topics")),
        "timeInsights": _as_string_list(plan.get("timeInsights")),
        "unfinishedReasons": _as_string_list(plan.get("unfinishedReasons")),
        "suggestedTasks": _as_task_suggestions(plan.get("suggestedTasks")),
        "tomorrowSchedule": _as_schedule_suggestions(plan.get("tomorrowSchedule")),
    }


def _as_text(value: Any) -> str:
    return str(value).strip() if value else ""


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [_as_text(item) for item in value if _as_text(item)]


def _as_task_suggestions(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    suggestions: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        title = _as_text(item.get("title"))
        if not title:
            continue
        suggestions.append(
            {
                "title": title,
                "plannedFor": _as_text(item.get("plannedFor")) or "tomorrow",
                "reason": _as_text(item.get("reason")),
            }
        )
    return suggestions[:8]


def _as_schedule_suggestions(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    suggestions: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        title = _as_text(item.get("title"))
        if not title:
            continue
        suggestions.append(
            {
                "startTime": _as_text(item.get("startTime")),
                "endTime": _as_text(item.get("endTime")),
                "title": title,
            }
        )
    return suggestions[:8]


def _infer_topics(journal: str, context: dict[str, Any]) -> list[str]:
    text = " ".join([journal, json.dumps(context.get("topApps", []), ensure_ascii=False)]).lower()
    topics: list[str] = []
    for keyword, topic in [
        ("transformer", "Transformer"),
        ("attention", "Attention"),
        ("rope", "RoPE"),
        ("python", "Python"),
        ("react", "React"),
        ("fastapi", "FastAPI"),
    ]:
        if keyword in text and topic not in topics:
            topics.append(topic)
    return topics or ["General learning"]
