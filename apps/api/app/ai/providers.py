from __future__ import annotations

import json
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_HTTP_HEADERS = {
    "User-Agent": "StudyPulse/0.1 (+https://github.com/1131351687/study-pulse)",
}


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


class DeepSeekProvider(OpenAICompatibleProvider):
    def __init__(self, endpoint: str, model: str, api_key: str) -> None:
        super().__init__(endpoint or "https://api.deepseek.com/v1", model or "deepseek-chat", api_key)


def create_provider(provider: str, endpoint: str, model: str, api_key: str) -> AIProvider:
    match provider.lower():
        case "openai":
            return OpenAICompatibleProvider(endpoint, model, api_key)
        case "deepseek":
            return DeepSeekProvider(endpoint, model, api_key)
        case "ollama":
            return OllamaProvider(endpoint, model)
        case _:
            return MockAIProvider()


def request_json_response(
    provider: str,
    endpoint: str,
    model: str,
    api_key: str,
    system_prompt: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    provider_name = provider.lower()
    if provider_name == "mock":
        return {}

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
    ]

    if provider_name in {"openai", "deepseek"}:
        selected_endpoint = endpoint.rstrip("/") or ("https://api.deepseek.com/v1" if provider_name == "deepseek" else "https://api.openai.com/v1")
        selected_model = model or ("deepseek-chat" if provider_name == "deepseek" else "gpt-4.1-mini")
        if not api_key:
            raise ValueError(f"API key is required for {provider_name}.")
        response = _post_json(
            f"{selected_endpoint}/chat/completions",
            {
                "model": selected_model,
                "messages": messages,
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
            {"Authorization": f"Bearer {api_key}"},
        )
        return _parse_json_content(response["choices"][0]["message"]["content"])

    if provider_name == "ollama":
        selected_endpoint = endpoint.rstrip("/") or "http://localhost:11434"
        selected_model = model or "llama3.1"
        response = _post_json(
            f"{selected_endpoint}/api/chat",
            {"model": selected_model, "messages": messages, "stream": False, "format": "json"},
            {},
        )
        return _parse_json_content(response["message"]["content"])

    raise ValueError(f"Unsupported provider: {provider_name}")


def test_provider_connection(provider: str, endpoint: str, model: str, api_key: str) -> dict[str, Any]:
    provider_name = provider.lower()
    try:
        match provider_name:
            case "openai":
                if not api_key:
                    return {"ok": False, "provider": provider_name, "message": "API key is required for OpenAI-compatible providers."}
                selected_endpoint = endpoint.rstrip("/") or "https://api.openai.com/v1"
                selected_model = model or "gpt-4.1-mini"
                success_message = "OpenAI-compatible chat request succeeded."
                _post_json(
                    f"{selected_endpoint}/chat/completions",
                    {
                        "model": selected_model,
                        "messages": [{"role": "user", "content": "Reply with ok."}],
                        "temperature": 0,
                        "max_tokens": 8,
                    },
                    {"Authorization": f"Bearer {api_key}"},
                    timeout_seconds=20,
                )
                return {"ok": True, "provider": provider_name, "message": success_message}
            case "deepseek":
                if not api_key:
                    return {"ok": False, "provider": provider_name, "message": "API key is required for DeepSeek."}
                selected_endpoint = endpoint.rstrip("/") or "https://api.deepseek.com/v1"
                selected_model = model or "deepseek-chat"
                success_message = "DeepSeek chat request succeeded."
                _post_json(
                    f"{selected_endpoint}/chat/completions",
                    {
                        "model": selected_model,
                        "messages": [{"role": "user", "content": "Reply with ok."}],
                        "temperature": 0,
                        "max_tokens": 8,
                    },
                    {"Authorization": f"Bearer {api_key}"},
                    timeout_seconds=20,
                )
                return {"ok": True, "provider": provider_name, "message": success_message}
            case "ollama":
                selected_endpoint = endpoint.rstrip("/") or "http://localhost:11434"
                selected_model = model or "llama3.1"
                _post_json(
                    f"{selected_endpoint}/api/chat",
                    {
                        "model": selected_model,
                        "messages": [{"role": "user", "content": "Reply with ok."}],
                        "stream": False,
                    },
                    {},
                    timeout_seconds=20,
                )
                return {"ok": True, "provider": provider_name, "message": "Ollama chat request succeeded."}
            case _:
                return {"ok": True, "provider": "mock", "message": "Mock provider is always available."}
    except ValueError as error:
        return {"ok": False, "provider": provider_name, "message": str(error)}


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


def _post_json(
    url: str,
    payload: dict[str, Any],
    headers: dict[str, str],
    timeout_seconds: float = 45,
) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            **DEFAULT_HTTP_HEADERS,
            **headers,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise ValueError(f"AI provider request failed: HTTP {error.code} {error.reason}. {detail}") from error
    except (URLError, TimeoutError, OSError) as error:
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
