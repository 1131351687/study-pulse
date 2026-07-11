from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ai.config_store import AIConfig, read_ai_config, save_ai_config
from app.ai.daily_context import build_daily_context, today_string
from app.ai.providers import create_provider, request_json_response, test_provider_connection
from app.day_record import build_day_record, list_recent_day_records, read_goal
from app.db import get_connection

router = APIRouter(tags=["ai"])


class DailyPlanRequest(BaseModel):
    date: str | None = None


class SummaryRequest(BaseModel):
    date: str | None = None


class GoalPlanRequest(BaseModel):
    date: str | None = None
    goalId: int


class GoalExpandRequest(BaseModel):
    goalId: int


class AIConfigRequest(BaseModel):
    provider: str
    endpoint: str = ""
    model: str = ""
    apiKey: str | None = None
    sendActivityTitles: bool = True
    planningPrompt: str = ""
    summaryPrompt: str = ""


@router.get("/ai/config")
def read_config() -> dict[str, Any]:
    config = read_ai_config()
    return {
        "provider": config.provider,
        "endpoint": config.endpoint,
        "model": config.model,
        "sendActivityTitles": config.send_activity_titles,
        "hasApiKey": bool(config.api_key),
        "planningPrompt": config.planning_prompt,
        "summaryPrompt": config.summary_prompt,
    }


@router.put("/ai/config")
def update_config(payload: AIConfigRequest) -> dict[str, Any]:
    current = read_ai_config()
    provider = payload.provider.strip().lower()
    if provider not in {"mock", "openai", "deepseek", "ollama"}:
        raise HTTPException(status_code=400, detail="Provider must be mock, openai, deepseek, or ollama.")

    api_key = current.api_key if payload.apiKey is None else payload.apiKey.strip()
    endpoint = _default_endpoint(provider, payload.endpoint.strip())
    model = _default_model(provider, payload.model.strip())
    config = save_ai_config(
        AIConfig(
            provider=provider,
            endpoint=endpoint,
            model=model,
            api_key=api_key,
            send_activity_titles=payload.sendActivityTitles,
            planning_prompt=payload.planningPrompt,
            summary_prompt=payload.summaryPrompt,
        )
    )
    return {
        "provider": config.provider,
        "endpoint": config.endpoint,
        "model": config.model,
        "sendActivityTitles": config.send_activity_titles,
        "hasApiKey": bool(config.api_key),
        "planningPrompt": config.planning_prompt,
        "summaryPrompt": config.summary_prompt,
    }


@router.post("/ai/test")
def test_config(payload: AIConfigRequest | None = None) -> dict[str, Any]:
    current = read_ai_config()
    if payload is None:
        config = current
    else:
        provider = payload.provider.strip().lower()
        if provider not in {"mock", "openai", "deepseek", "ollama"}:
            raise HTTPException(status_code=400, detail="Provider must be mock, openai, deepseek, or ollama.")
        config = AIConfig(
            provider=provider,
            endpoint=_default_endpoint(provider, payload.endpoint.strip()),
            model=_default_model(provider, payload.model.strip()),
            api_key=current.api_key if payload.apiKey is None else payload.apiKey.strip(),
            send_activity_titles=payload.sendActivityTitles,
        )
    return test_provider_connection(config.provider, config.endpoint, config.model, config.api_key)


@router.post("/ai/daily-plan")
def generate_daily_plan(payload: DailyPlanRequest) -> dict[str, Any]:
    config = read_ai_config()
    target_date = payload.date or today_string()
    context = build_daily_context(target_date)
    provider = create_provider(
        config.provider,
        config.endpoint,
        config.model,
        config.api_key,
    )

    try:
        result = provider.generate_daily_plan(context)
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    _save_generated_plan(target_date, config.provider, result)
    return {"date": target_date, "provider": config.provider, "result": result}


@router.post("/ai/summary")
def generate_summary(payload: SummaryRequest) -> dict[str, Any]:
    config = read_ai_config()
    target_date = payload.date or today_string()
    day_record = build_day_record(target_date)

    if config.provider == "mock":
        result = _mock_summary(day_record)
    else:
        summary_system_prompt = config.summary_prompt.strip()
        if summary_system_prompt:
            summary_system_prompt += (
                "\n\nIMPORTANT: You MUST return only valid JSON with keys: "
                "score (integer 0-100), summary (string), strengths (array of strings), "
                "blockers (array of strings), improvements (array of strings)."
            )
        else:
            summary_system_prompt = (
                "You summarize one study day. Return only JSON with keys: "
                "score, summary, strengths, blockers, improvements."
            )
        result = _normalize_summary(
            request_json_response(
                config.provider,
                config.endpoint,
                config.model,
                config.api_key,
                summary_system_prompt,
                day_record,
            )
        )

    summary_id, created_at = _save_summary(target_date, config.provider, result)
    return {"id": summary_id, "date": target_date, "provider": config.provider, "result": result, "createdAt": created_at}


@router.get("/ai/summary/{date}")
def read_summaries(date: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, provider, score, content_json, created_at FROM ai_summaries WHERE date = ? ORDER BY id DESC",
            (date,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "provider": row["provider"],
            "score": row["score"],
            "result": json.loads(row["content_json"]),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


@router.delete("/ai/summary-record/{summary_id}")
def delete_summary(summary_id: int) -> dict[str, bool]:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM ai_summaries WHERE id = ?", (summary_id,))
    return {"deleted": cursor.rowcount > 0}


@router.post("/ai/plan")
def generate_goal_plan(payload: GoalPlanRequest) -> dict[str, Any]:
    config = read_ai_config()
    target_date = payload.date or today_string()
    goal = read_goal(payload.goalId)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found.")
    if not goal["active"]:
        raise HTTPException(status_code=400, detail="Goal is inactive.")

    context = {
        "date": target_date,
        "goal": goal,
        "todayRecord": build_day_record(target_date),
        "recentRecords": list_recent_day_records(7),
        "milestones": _read_goal_milestones(payload.goalId),
    }

    if config.provider == "mock":
        result = _mock_goal_plan(context)
    else:
        system_prompt = config.planning_prompt.strip()
        if system_prompt:
            # 用户自定义 prompt → 追加 JSON 格式要求以确保兼容
            system_prompt += (
                "\n\nIMPORTANT: You MUST return only valid JSON with keys: "
                "todayPlan (array of strings), weekPlan (array of strings), "
                "suggestedTasks (array of objects with keys: title, reason, plannedFor)."
            )
        else:
            system_prompt = (
                "You create a study plan for one learning goal. Return only JSON with keys: "
                "todayPlan, weekPlan, suggestedTasks."
            )
        result = _normalize_goal_plan(
            request_json_response(
                config.provider,
                config.endpoint,
                config.model,
                config.api_key,
                system_prompt,
                context,
            )
        )

    # ── 构建建议任务列表（不入库，前端确认后才批量创建） ──
    suggested_tasks: list[dict[str, Any]] = []
    for task in result.get("suggestedTasks", []):
        title = str(task.get("title") or "").strip()
        if not title:
            continue
        suggested_tasks.append({
            "title": title,
            "reason": str(task.get("reason") or "").strip(),
            "plannedFor": str(task.get("plannedFor") or "today"),
            "area": goal["name"],
            "priority": "normal",
        })

    return {
        "todayPlan": result.get("todayPlan", []),
        "suggestedTasks": suggested_tasks,
    }


@router.get("/ai/daily-plan/{date}")
def read_daily_plan(date: str) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT date, provider, content_json, updated_at FROM generated_plans WHERE date = ?",
            (date,),
        ).fetchone()
    if row is None:
        return {"date": date, "provider": "", "result": None, "updatedAt": ""}
    return {
        "date": row["date"],
        "provider": row["provider"],
        "result": json.loads(row["content_json"]),
        "updatedAt": row["updated_at"],
    }


@router.post("/ai/expand-description")
def expand_goal_description(payload: GoalExpandRequest) -> dict[str, Any]:
    goal = read_goal(payload.goalId)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found.")

    config = read_ai_config()
    goal_name = goal["name"]
    current_desc = goal["description"]

    if config.provider == "mock":
        # Mock: 生成详细学习路线
        expanded = (
            f"## {goal_name} 学习路线\n\n"
            f"### 第一阶段：基础入门\n"
            f"了解 {goal_name} 的核心概念和应用场景，阅读入门教程和文档。\n\n"
            f"### 第二阶段：深入理解\n"
            f"系统学习 {goal_name} 的核心原理，完成配套练习和项目。\n\n"
            f"### 第三阶段：实践应用\n"
            f"将 {goal_name} 应用到实际项目中，解决真实问题。\n\n"
            f"### 第四阶段：总结巩固\n"
            f"整理学习笔记，撰写总结文章，分享学习经验。"
        )
    else:
        system_prompt = (
            "你是学习规划专家。根据目标名称和已有描述，生成一份详细的学习路线规划。"
            "请以JSON格式返回，包含一个key 'plan'，值为一份详细的Markdown格式学习路线文本（包含阶段划分、学习内容、实践项目）。"
        )
        context = {"goalName": goal_name, "currentDescription": current_desc}
        try:
            response = request_json_response(config.provider, config.endpoint, config.model, config.api_key, system_prompt, context)
            expanded = response.get("plan") or response.get("description") or response.get("result") or str(response)
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            raise HTTPException(status_code=502, detail=str(error)) from error

    with get_connection() as connection:
        connection.execute(
            "UPDATE learning_goals SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (expanded, payload.goalId),
        )
        row = connection.execute(
            "SELECT id, name, description, current_focus, active, created_at, updated_at FROM learning_goals WHERE id = ?",
            (payload.goalId,),
        ).fetchone()

    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "currentFocus": row["current_focus"],
        "active": bool(row["active"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _save_generated_plan(target_date: str, provider: str, result: dict[str, Any]) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO generated_plans (date, provider, content_json, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(date) DO UPDATE SET
                provider = excluded.provider,
                content_json = excluded.content_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (target_date, provider, json.dumps(result, ensure_ascii=False)),
        )


def _save_summary(target_date: str, provider: str, result: dict[str, Any]) -> tuple[int, str]:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO ai_summaries (date, provider, score, content_json) VALUES (?, ?, ?, ?)",
            (target_date, provider, int(result.get("score") or 0), json.dumps(result, ensure_ascii=False)),
        )
        row = connection.execute("SELECT id, created_at FROM ai_summaries WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return int(row["id"]), str(row["created_at"])


def _normalize_summary(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "score": _bounded_score(payload.get("score")),
        "summary": str(payload.get("summary") or "").strip(),
        "strengths": _string_list(_as_list(payload.get("strengths"))),
        "blockers": _string_list(_as_list(payload.get("blockers"))),
        "improvements": _string_list(_as_list(payload.get("improvements"))),
    }


def _normalize_goal_plan(payload: dict[str, Any]) -> dict[str, Any]:
    tasks = _as_list(payload.get("suggestedTasks"))
    return {
        "todayPlan": _string_list(_as_list(payload.get("todayPlan"))),
        "weekPlan": _string_list(_as_list(payload.get("weekPlan"))),
        "suggestedTasks": [
            {
                "title": str(task.get("title") or "").strip(),
                "reason": str(task.get("reason") or "").strip(),
                "plannedFor": str(task.get("plannedFor") or "today").strip(),
            }
            for task in (_coerce_task(task) for task in tasks)
            if str(task.get("title") or "").strip()
        ],
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _as_list(value: Any) -> list[Any]:
    """Coerce scalars and dicts into list form so normalizers stay tolerant."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        return [stripped] if stripped else []
    return [value]


def _coerce_task(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    title = str(value).strip() if value is not None else ""
    return {"title": title, "reason": "", "plannedFor": "today"}


def _bounded_score(value: Any) -> int:
    try:
        return max(0, min(int(value), 100))
    except (TypeError, ValueError):
        return 0


def _mock_summary(day_record: dict[str, Any]) -> dict[str, Any]:
    tracked_seconds = float(day_record.get("activity", {}).get("totalSeconds") or 0)
    journal = day_record.get("journal", {}).get("content") or ""
    score = 78 if tracked_seconds > 3600 else 62
    return {
        "score": score,
        "summary": f"Tracked {round(tracked_seconds / 60)} minutes. Journal focus: {journal[:120] or 'No journal yet.'}",
        "strengths": ["Kept a visible study record.", "Has a concrete day-level learning trail."],
        "blockers": ["Need clearer task follow-through."] if not day_record.get("scheduleBlocks") else ["Review whether schedule blocks matched actual work."],
        "improvements": ["Write one sharper end-of-day note.", "Carry one specific task into tomorrow."],
    }


def _mock_goal_plan(context: dict[str, Any]) -> dict[str, Any]:
    goal = context["goal"]
    focus = goal.get("currentFocus") or goal.get("name")
    milestones = context.get("milestones") or []
    completed_milestones = [m for m in milestones if m["completed"]]
    incomplete_milestones = [m for m in milestones if not m["completed"]]

    # 分析近期日志推断学习主题
    recent = context.get("recentRecords") or []
    journal_texts = []
    for record in recent:
        journal = record.get("journal", {}).get("content", "") or ""
        if journal.strip():
            journal_texts.append(journal.lower())
    all_text = " ".join(journal_texts)

    topics = []
    for keyword, topic in [
        ("transformer", "Transformer"), ("attention", "Attention"), ("rope", "RoPE"),
        ("python", "Python"), ("react", "React"), ("fastapi", "FastAPI"),
        ("neural", "Neural Networks"), ("rl", "Reinforcement Learning"),
        ("cv", "Computer Vision"), ("nlp", "NLP"), ("database", "Databases"),
        ("sql", "SQL"), ("docker", "Docker"), ("linux", "Linux"),
    ]:
        if keyword in all_text and topic not in topics:
            topics.append(topic)
    if not topics:
        topics = [focus]

    today_items = []
    # 如果有未完成的里程碑，优先建议
    for m in incomplete_milestones[:2]:
        today_items.append(f"推进里程碑「{m['title']}」：完成当前阶段学习")
    for topic_name in topics[:2]:
        today_items.append(f"深入学习 {topic_name}：阅读核心资料并做笔记")
    today_items.append(f"撰写今日学习总结，记录关键收获和疑问")

    suggested = []
    if incomplete_milestones:
        suggested.append({"title": f"完成里程碑：{incomplete_milestones[0]['title']}", "reason": "当前学习阶段的关键任务", "plannedFor": "today"})
    suggested.append({"title": f"学习 {topics[0]}", "reason": "今日首要学习目标", "plannedFor": "today"})
    suggested.append({"title": f"整理 {goal['name']} 笔记", "reason": "将学习内容转化为持久记录", "plannedFor": "today"})

    return {
        "todayPlan": today_items[:6],
        "suggestedTasks": suggested,
    }


def _default_endpoint(provider: str, endpoint: str) -> str:
    if endpoint:
        return endpoint
    if provider == "openai":
        return "https://api.openai.com/v1"
    if provider == "deepseek":
        return "https://api.deepseek.com/v1"
    if provider == "ollama":
        return "http://localhost:11434"
    return ""


def _default_model(provider: str, model: str) -> str:
    if model:
        return model
    if provider == "openai":
        return "gpt-4.1-mini"
    if provider == "deepseek":
        return "deepseek-chat"
    if provider == "ollama":
        return "llama3.1"
    return ""


def _read_goal_milestones(goal_id: int) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, title, completed, position FROM goal_milestones WHERE goal_id = ? ORDER BY position ASC, id ASC",
            (goal_id,),
        ).fetchall()
    return [
        {"id": row["id"], "title": row["title"], "completed": bool(row["completed"]), "position": row["position"]}
        for row in rows
    ]
