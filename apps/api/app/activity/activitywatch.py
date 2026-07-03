from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date as date_type, datetime, time, timedelta
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


WATCHED_BUCKET_TYPES = {
    "currentwindow",
    "web.tab.current",
    "app.editor.activity",
}


@dataclass(frozen=True)
class ActivityEntry:
    name: str
    seconds: float


@dataclass(frozen=True)
class TodayActivitySummary:
    date: str
    available: bool
    message: str
    total_seconds: float
    bucket_count: int
    top_apps: list[ActivityEntry]
    top_titles: list[ActivityEntry]

    def to_dict(self) -> dict[str, Any]:
        return {
            "date": self.date,
            "available": self.available,
            "message": self.message,
            "totalSeconds": round(self.total_seconds, 2),
            "bucketCount": self.bucket_count,
            "topApps": [entry.__dict__ for entry in self.top_apps],
            "topTitles": [entry.__dict__ for entry in self.top_titles],
        }


class ActivityWatchClient:
    def __init__(self, base_url: str, timeout_seconds: float = 5.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def today_summary(self) -> TodayActivitySummary:
        return self.day_summary()

    def day_summary(self, target_date: str | None = None) -> TodayActivitySummary:
        now = datetime.now().astimezone()
        day = _parse_date(target_date) if target_date else now.date()
        start = datetime.combine(day, time.min, tzinfo=now.tzinfo)
        end = now if day == now.date() else start + timedelta(days=1)

        try:
            buckets = self._get_json("/api/0/buckets/")
            selected = self._select_activity_buckets(buckets)
            if not selected:
                return TodayActivitySummary(
                    date=day.isoformat(),
                    available=True,
                    message="ActivityWatch is running, but no supported activity buckets were found.",
                    total_seconds=0,
                    bucket_count=0,
                    top_apps=[],
                    top_titles=[],
                )

            app_seconds: dict[str, float] = defaultdict(float)
            title_seconds: dict[str, float] = defaultdict(float)

            for bucket_id in selected:
                events = self._read_events(bucket_id, start, end)
                self._aggregate_events(events, app_seconds, title_seconds)

            total_seconds = sum(app_seconds.values())
            return TodayActivitySummary(
                date=day.isoformat(),
                available=True,
                message="ActivityWatch data loaded.",
                total_seconds=total_seconds,
                bucket_count=len(selected),
                top_apps=self._top_entries(app_seconds),
                top_titles=self._top_entries(title_seconds),
            )
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
            return TodayActivitySummary(
                date=day.isoformat(),
                available=False,
                message=f"ActivityWatch unavailable: {error}",
                total_seconds=0,
                bucket_count=0,
                top_apps=[],
                top_titles=[],
            )

    def _get_json(self, path: str) -> Any:
        request = Request(f"{self.base_url}{path}", headers={"Accept": "application/json"})
        with urlopen(request, timeout=self.timeout_seconds) as response:
            payload = response.read().decode("utf-8")
        return json.loads(payload)

    def _read_events(self, bucket_id: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
        query = urlencode({"start": start.isoformat(), "end": end.isoformat()})
        path = f"/api/0/buckets/{quote(bucket_id, safe='')}/events?{query}"
        events = self._get_json(path)
        if isinstance(events, list):
            return events
        return []

    def _select_activity_buckets(self, buckets: Any) -> list[str]:
        if not isinstance(buckets, dict):
            return []

        selected: list[str] = []
        for bucket_id, bucket in buckets.items():
            if not isinstance(bucket, dict):
                continue
            bucket_type = str(bucket.get("type") or "")
            client = str(bucket.get("client") or "")
            if bucket_type in WATCHED_BUCKET_TYPES or client in {"aw-watcher-window", "aw-client-web", "aw-watcher-vscode"}:
                selected.append(str(bucket_id))
        return selected

    def _aggregate_events(
        self,
        events: list[dict[str, Any]],
        app_seconds: dict[str, float],
        title_seconds: dict[str, float],
    ) -> None:
        for event in events:
            duration = self._duration_seconds(event.get("duration"))
            if duration <= 0:
                continue

            data = event.get("data") if isinstance(event.get("data"), dict) else {}
            app = self._read_label(data, ["app", "browser", "project", "language"], "Unknown app")
            title = self._read_label(data, ["title", "url", "file", "project"], app)

            app_seconds[app] += duration
            title_seconds[title] += duration

    def _duration_seconds(self, value: Any) -> float:
        try:
            return max(float(value), 0.0)
        except (TypeError, ValueError):
            return 0.0

    def _read_label(self, data: dict[str, Any], keys: list[str], fallback: str) -> str:
        for key in keys:
            value = data.get(key)
            if value:
                return str(value).strip()[:180]
        return fallback

    def _top_entries(self, seconds_by_name: dict[str, float], limit: int = 8) -> list[ActivityEntry]:
        entries = sorted(seconds_by_name.items(), key=lambda item: item[1], reverse=True)[:limit]
        return [ActivityEntry(name=name, seconds=round(seconds, 2)) for name, seconds in entries]


def _parse_date(value: str) -> date_type:
    try:
        return date_type.fromisoformat(value)
    except ValueError:
        return datetime.now().astimezone().date()
